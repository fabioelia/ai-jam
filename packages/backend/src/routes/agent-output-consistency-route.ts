import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputConsistency } from '../services/agent-output-consistency-service.js';
import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export async function agentOutputConsistencyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-output-consistency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };

    const projectTickets = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.projectId, projectId));
    const ticketIds = projectTickets.map(t => t.id);
    let sessions: any[] = [];
    if (ticketIds.length > 0) {
      sessions = await db.select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        outputSummary: agentSessions.outputSummary,
      }).from(agentSessions).where(inArray(agentSessions.ticketId, ticketIds));
    }

    return analyzeAgentOutputConsistency(projectId, sessions);
  });
}
