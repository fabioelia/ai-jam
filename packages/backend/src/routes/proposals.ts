import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { ticketProposals } from '../db/schema.js';
import { broadcastToFeature } from '../websocket/socket-server.js';
import { getSourceFromRequest } from '../utils/source-header.js';
import { approveProposal } from '../services/proposal-service.js';

export async function proposalRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List proposals for a feature
  fastify.get<{ Params: { featureId: string }; Querystring: { status?: string } }>(
    '/api/features/:featureId/proposals',
    async (request) => {
      const { featureId } = request.params;
      const { status } = request.query;

      const conditions = [eq(ticketProposals.featureId, featureId)];
      if (status) conditions.push(eq(ticketProposals.status, status));

      return db
        .select()
        .from(ticketProposals)
        .where(and(...conditions));
    }
  );

  // Create a proposal (used by MCP server agents)
  fastify.post<{
    Params: { featureId: string };
    Body: {
      chatSessionId: string;
      ticketData: {
        title: string;
        description: string;
        epicTitle?: string;
        priority?: string;
        storyPoints?: number;
        acceptanceCriteria?: string[];
      };
    };
  }>(
    '/api/features/:featureId/proposals',
    async (request, reply) => {
      const { featureId } = request.params;
      const { chatSessionId, ticketData } = request.body;

      if (!chatSessionId || !ticketData?.title) {
        return reply.status(400).send({ error: 'chatSessionId and ticketData.title are required' });
      }

      const source = getSourceFromRequest(request);

      const [proposal] = await db
        .insert(ticketProposals)
        .values({
          chatSessionId,
          featureId,
          status: 'pending',
          ticketData,
          source,
        })
        .returning();

      broadcastToFeature(featureId, 'proposal:created', {
        proposalId: proposal.id,
        ticketData,
      });

      // Auto-approve: create real ticket immediately
      const result = await approveProposal(proposal.id, request.user.userId, { source });

      return result;
    }
  );

  // Get single proposal
  fastify.get<{ Params: { id: string } }>(
    '/api/proposals/:id',
    async (request, reply) => {
      const [proposal] = await db
        .select()
        .from(ticketProposals)
        .where(eq(ticketProposals.id, request.params.id));
      if (!proposal) return reply.status(404).send({ error: 'Proposal not found' });
      return proposal;
    }
  );

  // Approve a proposal — creates the actual ticket
  fastify.post<{ Params: { id: string }; Body: { ticketData?: Record<string, unknown> } }>(
    '/api/proposals/:id/approve',
    async (request, reply) => {
      const [proposal] = await db
        .select()
        .from(ticketProposals)
        .where(eq(ticketProposals.id, request.params.id));
      if (!proposal) return reply.status(404).send({ error: 'Proposal not found' });
      if (proposal.status !== 'pending') {
        return reply.status(400).send({ error: 'Proposal is not pending' });
      }

      const source = getSourceFromRequest(request);

      return approveProposal(proposal.id, request.user.userId, {
        ticketData: request.body?.ticketData,
        source,
      });
    }
  );

  // Reject a proposal
  fastify.post<{ Params: { id: string } }>(
    '/api/proposals/:id/reject',
    async (request, reply) => {
      const [proposal] = await db
        .select()
        .from(ticketProposals)
        .where(eq(ticketProposals.id, request.params.id));
      if (!proposal) return reply.status(404).send({ error: 'Proposal not found' });
      if (proposal.status !== 'pending') {
        return reply.status(400).send({ error: 'Proposal is not pending' });
      }

      await db
        .update(ticketProposals)
        .set({ status: 'rejected', resolvedAt: new Date() })
        .where(eq(ticketProposals.id, proposal.id));

      broadcastToFeature(proposal.featureId, 'proposal:rejected', {
        proposalId: proposal.id,
      });

      return { ...proposal, status: 'rejected' };
    }
  );

  // Edit a proposal (update ticket data before approving)
  fastify.patch<{ Params: { id: string }; Body: { ticketData: Record<string, unknown> } }>(
    '/api/proposals/:id',
    async (request, reply) => {
      const [proposal] = await db
        .select()
        .from(ticketProposals)
        .where(eq(ticketProposals.id, request.params.id));
      if (!proposal) return reply.status(404).send({ error: 'Proposal not found' });
      if (proposal.status !== 'pending') {
        return reply.status(400).send({ error: 'Proposal is not pending' });
      }

      const merged = { ...(proposal.ticketData as object), ...request.body.ticketData };

      const [updated] = await db
        .update(ticketProposals)
        .set({ ticketData: merged, status: 'edited' })
        .where(eq(ticketProposals.id, proposal.id))
        .returning();

      return updated;
    }
  );
}
