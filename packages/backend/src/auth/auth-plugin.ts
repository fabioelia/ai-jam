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
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
