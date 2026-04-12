import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const REFRESH_SECRET = 'dev-refresh-secret';

function makeRefreshToken(payload: { userId: string; email: string }, expiresIn = '7d') {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn });
}

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Hoisted mocks
const { limitMock, valuesMock, deleteWhereMock } = vi.hoisted(() => {
  const limitMock = vi.fn();
  const valuesMock = vi.fn().mockResolvedValue([]);
  const deleteWhereMock = vi.fn().mockResolvedValue([]);
  return { limitMock, valuesMock, deleteWhereMock };
});

vi.mock('../config.js', () => ({
  config: {
    jwtSecret: 'test-access-secret',
    jwtRefreshSecret: REFRESH_SECRET,
    frontendUrl: 'http://localhost:5174',
  },
}));

vi.mock('./password.js', () => ({
  hashPassword: vi.fn(async (p: string) => `hashed-${p}`),
  verifyPassword: vi.fn(async (p: string, h: string) => h === `hashed-${p}`),
}));

vi.mock('@ai-jam/shared', () => ({
  loginSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  registerSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  forgotPasswordSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  resetPasswordSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
}));

vi.mock('../db/connection.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: limitMock }) }) }),
    insert: () => ({ values: valuesMock }),
    delete: () => ({ where: deleteWhereMock }),
  },
}));

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(fjwt, { secret: 'test-access-secret' });

  const { authRoutes } = await import('./auth-routes.js');
  await app.register(authRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  valuesMock.mockResolvedValue([]);
  deleteWhereMock.mockResolvedValue([]);
});

describe('POST /api/auth/refresh — token rotation', () => {
  it('returns 400 when refreshToken missing from body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Refresh token required' });
  });

  it('returns 401 for malformed JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'not-a-valid-jwt' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid refresh token' });
  });

  it('returns 401 for JWT signed with wrong secret', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com' }, 'wrong-secret', { expiresIn: '7d' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for expired JWT', async () => {
    const expired = jwt.sign(
      { userId: 'u1', email: 'a@b.com' },
      REFRESH_SECRET,
      { expiresIn: '0s' },
    );
    await new Promise((r) => setTimeout(r, 50));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: expired },
    });

    expect(res.statusCode).toBe(401);
    // DB should not be queried — JWT verify fails first
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns 401 when token not found in DB (already rotated/revoked)', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([]); // not in DB

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid refresh token' });
  });

  it('rotates: returns new accessToken AND refreshToken', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([{
      id: 'rt-1',
      userId: 'u1',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('deletes old token from DB on rotation', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([{
      id: 'rt-1',
      userId: 'u1',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);

    await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    expect(deleteWhereMock).toHaveBeenCalledOnce();
  });

  it('stores new refresh token in DB on rotation', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([{
      id: 'rt-1',
      userId: 'u1',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    // storeRefreshToken calls db.insert().values()
    expect(valuesMock).toHaveBeenCalledOnce();
    const insertArgs = valuesMock.mock.calls[0][0];
    expect(insertArgs).toMatchObject({
      userId: 'u1',
      tokenHash: expect.any(String),
      expiresAt: expect.any(Date),
    });
    expect(insertArgs.tokenHash).toHaveLength(64);

    // Stored hash must match the new refresh token returned to client
    const body = JSON.parse(res.body);
    expect(insertArgs.tokenHash).toBe(hashToken(body.refreshToken));
    // New token differs from the submitted one
    expect(body.refreshToken).not.toBe(token);
    expect(insertArgs.tokenHash).not.toBe(hashToken(token));
  });

  it('new accessToken contains correct user payload', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([{
      id: 'rt-1',
      userId: 'u1',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    const body = JSON.parse(res.body);
    const decoded = jwt.verify(body.accessToken, 'test-access-secret') as Record<string, unknown>;
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('a@b.com');
  });

  it('new refreshToken is a valid JWT with correct payload', async () => {
    const token = makeRefreshToken({ userId: 'u1', email: 'a@b.com' });
    limitMock.mockResolvedValueOnce([{
      id: 'rt-1',
      userId: 'u1',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token },
    });

    const body = JSON.parse(res.body);
    const decoded = jwt.verify(body.refreshToken, REFRESH_SECRET) as Record<string, unknown>;
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('a@b.com');
  });
});
