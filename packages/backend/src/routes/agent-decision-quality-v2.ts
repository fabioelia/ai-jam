import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { analyzeAgentDecisionQuality } from '../services/agent-decision-quality-service-v2.js';

export async function agentDecisionQualityV2Routes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-decision-quality-v2', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };

    const projectTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.projectId, projectId));

    const ticketIds = projectTickets.map((t) => t.id);
    let sessions: any[] = [];

    if (ticketIds.length > 0) {
      sessions = await db
        .select({
          id: agentSessions.id,
          personaType: agentSessions.personaType,
          status: agentSessions.status,
          retryCount: agentSessions.retryCount,
        })
        .from(agentSessions)
        .where(inArray(agentSessions.ticketId, ticketIds));
    }

    return analyzeAgentDecisionQuality(projectId, sessions);
  });
}
