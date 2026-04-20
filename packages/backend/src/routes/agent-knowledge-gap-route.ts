import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeGaps } from '../services/agent-knowledge-gap-service.js';
import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export async function agentKnowledgeGapAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-knowledge-gap', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };

    const projectTickets = await db
      .select({ id: tickets.id, title: tickets.title })
      .from(tickets)
      .where(eq(tickets.projectId, projectId));

    const ticketIds = projectTickets.map((t) => t.id);
    const ticketMap = new Map(projectTickets.map((t) => [t.id, t]));

    let sessions: any[] = [];
    if (ticketIds.length > 0) {
      const rows = await db
        .select({
          id: agentSessions.id,
          ticketId: agentSessions.ticketId,
          personaType: agentSessions.personaType,
          status: agentSessions.status,
          retryCount: agentSessions.retryCount,
        })
        .from(agentSessions)
        .where(inArray(agentSessions.ticketId, ticketIds));

      sessions = rows.map((r) => {
        const ticket = ticketMap.get(r.ticketId);
        return {
          agentId: r.personaType,
          title: ticket?.title ?? '',
          tags: [],
          status: r.status,
          retries: r.retryCount ?? 0,
          escalated: false,
        };
      });
    }

    return analyzeAgentKnowledgeGaps(projectId, sessions);
  });
}
