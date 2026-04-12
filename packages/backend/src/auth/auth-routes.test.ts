import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Tests rate limiting on auth endpoints.
 * Uses a minimal Fastify instance with dummy handlers (no DB) to verify
 * that @fastify/rate-limit enforces the configured per-route limits.
 */

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Mirrors the rate-limit config from auth-routes.ts
  const authRateLimit = {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  };
  const registerRateLimit = {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  };

  app.post('/api/auth/login', authRateLimit, async () => ({ ok: true }));
  app.post('/api/auth/register', registerRateLimit, async () => ({ ok: true }));
  app.post('/api/auth/refresh', authRateLimit, async () => ({ ok: true }));
  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('rate limiting on auth endpoints', () => {
  it('allows login requests up to the limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
      expect(res.statusCode).toBe(200);
    }
  });

  it('rejects login after exceeding 5 requests/min', async () => {
    // Previous test already consumed 5 requests
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('returns rate limit headers on login', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(res.headers).toHaveProperty('x-ratelimit-limit');
    expect(res.headers['x-ratelimit-limit']).toBe('5');
  });

  it('rejects register after exceeding 3 requests/min', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {} });
      expect(res.statusCode).toBe(200);
    }
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {} });
    expect(res.statusCode).toBe(429);
  });

  it('rejects refresh after exceeding 5 requests/min', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: {} });
      expect(res.statusCode).toBe(200);
    }
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: {} });
    expect(res.statusCode).toBe(429);
  });

  it('does not rate limit health endpoint at auth limits', async () => {
    // Global limit is 100/min — health should be fine after many requests
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
    }
  });
});
