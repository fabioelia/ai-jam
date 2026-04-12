import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fjwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: '15m' },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // Allow service token authentication (for the orchestrator and other internal services).
    // The token is passed as a Bearer token and matched against the configured static value.
    if (config.serviceToken) {
      const authHeader = request.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        if (token === config.serviceToken) {
          // Inject a synthetic service user so downstream handlers work
          (request as unknown as { user: { userId: string; email: string } }).user = {
            userId: process.env.AIJAM_SERVICE_USER_ID || 'service',
            email: 'service@ai-jam.local',
          };
          return;
        }
      }
    }

    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
