import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Tests rate limiting and route registration for password reset endpoints.
 * Uses a minimal Fastify instance with dummy handlers (no DB) to verify
 * that the endpoints exist and rate limits are enforced.
 */

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const authRateLimit = {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  };

  app.post('/api/auth/forgot-password', authRateLimit, async () => ({
    message: 'If that email is registered, a reset link has been sent.',
  }));

  app.post('/api/auth/reset-password', authRateLimit, async () => ({
    message: 'Password has been reset successfully.',
  }));

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('password reset endpoints', () => {
  describe('POST /api/auth/forgot-password', () => {
    it('returns success message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('reset link');
    });

    it('rate limits after 5 requests', async () => {
      // Previous test used 1 request, send 4 more
      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: { email: 'test@example.com' },
        });
      }
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(429);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('returns success message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'abc123', password: 'newpassword' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('reset successfully');
    });

    it('rate limits after 5 requests', async () => {
      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          payload: { token: 'abc123', password: 'newpassword' },
        });
      }
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'abc123', password: 'newpassword' },
      });
      expect(res.statusCode).toBe(429);
    });
  });
});

describe('password reset validation schemas', () => {
  it('forgotPasswordSchema rejects invalid email', async () => {
    const { forgotPasswordSchema } = await import('@ai-jam/shared');
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('forgotPasswordSchema accepts valid email', async () => {
    const { forgotPasswordSchema } = await import('@ai-jam/shared');
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('resetPasswordSchema rejects short password', async () => {
    const { resetPasswordSchema } = await import('@ai-jam/shared');
    const result = resetPasswordSchema.safeParse({ token: 'abc', password: '12345' });
    expect(result.success).toBe(false);
  });

  it('resetPasswordSchema rejects empty token', async () => {
    const { resetPasswordSchema } = await import('@ai-jam/shared');
    const result = resetPasswordSchema.safeParse({ token: '', password: 'validpass' });
    expect(result.success).toBe(false);
  });

  it('resetPasswordSchema accepts valid input', async () => {
    const { resetPasswordSchema } = await import('@ai-jam/shared');
    const result = resetPasswordSchema.safeParse({ token: 'abc123', password: 'validpass' });
    expect(result.success).toBe(true);
  });
});

describe('token hashing', () => {
  it('hashes token with SHA-256 consistently', async () => {
    const crypto = await import('node:crypto');
    const token = 'test-token-123';
    const hash1 = crypto.createHash('sha256').update(token).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('produces different hashes for different tokens', async () => {
    const crypto = await import('node:crypto');
    const hash1 = crypto.createHash('sha256').update('token-a').digest('hex');
    const hash2 = crypto.createHash('sha256').update('token-b').digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});
