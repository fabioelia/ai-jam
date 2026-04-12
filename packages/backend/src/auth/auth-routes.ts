import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { loginSchema, registerSchema } from '@ai-jam/shared';
import { config } from '../config.js';
import jwt from 'jsonwebtoken';

export async function authRoutes(fastify: FastifyInstance) {
  // Strict rate limits for auth endpoints to prevent brute-force attacks
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  };

  const registerRateLimit = {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      },
    },
  };

  fastify.post('/api/auth/register', registerRateLimit, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, name, password } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({ email, name, passwordHash }).returning();

    const payload = { userId: user.id, email: user.email };
    const accessToken = fastify.jwt.sign(payload);
    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
      tokens: { accessToken, refreshToken },
    };
  });

  fastify.post('/api/auth/login', authRateLimit, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = fastify.jwt.sign(payload);
    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
      tokens: { accessToken, refreshToken },
    };
  });

  fastify.post('/api/auth/refresh', authRateLimit, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token required' });
    }

    try {
      const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string; email: string };
      const accessToken = fastify.jwt.sign({ userId: payload.userId, email: payload.email });
      return { accessToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });
}
