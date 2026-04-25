import { FastifyInstance } from 'fastify';
import { analyzeAgentMemoryPersistence } from '../services/agent-memory-persistence-analyzer-service.js';

export async function agentMemoryPersistenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-memory-persistence-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentMemoryPersistence();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent memory persistence' });
    }
  });
}
