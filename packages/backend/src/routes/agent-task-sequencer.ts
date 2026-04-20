import { FastifyInstance } from 'fastify';
import { sequenceTasks } from '../services/agent-task-sequencer-service.js';

export async function agentTaskSequencerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-task-sequence', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await sequenceTasks(projectId);
    return result;
  });
}
