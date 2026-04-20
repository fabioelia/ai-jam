import { FastifyInstance } from 'fastify';
import { profileAgentSkills } from '../services/agent-skill-profiler-service.js';

export async function agentSkillProfilerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-skill-profiles', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await profileAgentSkills(projectId);
    return result;
  });
}
