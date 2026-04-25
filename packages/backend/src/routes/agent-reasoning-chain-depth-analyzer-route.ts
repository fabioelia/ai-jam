import { FastifyInstance } from 'fastify';
import { analyzeAgentReasoningChainDepth } from '../services/agent-reasoning-chain-depth-analyzer-service.js';

export async function agentReasoningChainDepthAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-reasoning-chain-depth-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentReasoningChainDepth();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent reasoning chain depth' });
    }
  });
}
