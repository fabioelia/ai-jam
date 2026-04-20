import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionCompliance } from '../services/agent-instruction-compliance-service.js';

export async function agentInstructionComplianceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-instruction-compliance', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentInstructionCompliance(projectId);
  });
}
