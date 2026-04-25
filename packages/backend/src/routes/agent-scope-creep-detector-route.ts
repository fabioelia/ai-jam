import { FastifyInstance } from 'fastify';
import { detectAgentScopeCreep } from '../services/agent-scope-creep-detector-service.js';

export async function agentScopeCreepDetectorRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-scope-creep-detector', async (request, reply) => {
    try {
      const report = await detectAgentScopeCreep();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to detect agent scope creep' });
    }
  });
}
