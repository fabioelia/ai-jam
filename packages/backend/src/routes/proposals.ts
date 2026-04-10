import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { ticketProposals, tickets, epics, features } from '../db/schema.js';
import { broadcastToBoard, broadcastToFeature } from '../websocket/socket-server.js';

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

      const data = (request.body?.ticketData || proposal.ticketData) as Record<string, unknown>;

      // Get the feature to find projectId
      const [feature] = await db
        .select()
        .from(features)
        .where(eq(features.id, proposal.featureId));
      if (!feature) return reply.status(404).send({ error: 'Feature not found' });

      // Resolve epic if epicTitle is provided
      let epicId: string | null = null;
      if (data.epicTitle) {
        const [existingEpic] = await db
          .select()
          .from(epics)
          .where(and(eq(epics.featureId, proposal.featureId), eq(epics.title, data.epicTitle as string)));

        if (existingEpic) {
          epicId = existingEpic.id;
        } else {
          // Create the epic
          const [newEpic] = await db
            .insert(epics)
            .values({
              featureId: proposal.featureId,
              title: data.epicTitle as string,
              color: (data.epicColor as string) || null,
            })
            .returning();
          epicId = newEpic.id;

          broadcastToBoard(feature.projectId, 'board:epic:created', { epic: newEpic });
        }
      }

      // Create the ticket
      const [ticket] = await db
        .insert(tickets)
        .values({
          featureId: proposal.featureId,
          projectId: feature.projectId,
          epicId,
          title: data.title as string,
          description: (data.description as string) || null,
          priority: (data.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
          storyPoints: (data.storyPoints as number) || null,
          createdBy: request.user.userId,
        })
        .returning();

      // Update proposal status
      await db
        .update(ticketProposals)
        .set({ status: 'approved', resolvedAt: new Date() })
        .where(eq(ticketProposals.id, proposal.id));

      // Broadcast events
      broadcastToBoard(feature.projectId, 'board:ticket:created', { ticket });
      broadcastToFeature(proposal.featureId, 'proposal:approved', {
        proposalId: proposal.id,
        ticketId: ticket.id,
      });

      return { proposal: { ...proposal, status: 'approved' }, ticket };
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
