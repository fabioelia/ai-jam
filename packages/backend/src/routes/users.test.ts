import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { userRoutes } from './users.js';

// Mock the DB layer
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: 'https://ai-jam-avatars.s3.us-east-1.amazonaws.com/avatars/user-1/abc.webp',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]),
  },
}));

// Mock avatar service
vi.mock('../services/avatar-service.js', () => ({
  validateAvatarMimetype: vi.fn((mime: string) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)),
  validateAvatarSize: vi.fn((size: number) => size <= 5 * 1024 * 1024),
  resizeAvatar: vi.fn(async () => Buffer.from('resized-image')),
  uploadAvatarToS3: vi.fn(async () => 'https://ai-jam-avatars.s3.us-east-1.amazonaws.com/avatars/user-1/abc.webp'),
  deleteAvatarFromS3: vi.fn(async () => {}),
}));

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // Fake authenticate decorator
  app.decorate('authenticate', async () => {});
  app.addHook('onRequest', async (request) => {
    (request as any).user = { userId: 'user-1', email: 'test@test.com' };
  });

  await app.register(userRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/users/me', () => {
  it('returns current user profile', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users/me' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id', 'user-1');
    expect(body).toHaveProperty('email', 'test@test.com');
  });
});

describe('POST /api/users/me/avatar', () => {
  it('rejects request with no file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/me/avatar',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    // Multipart plugin will error or route returns 400
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('accepts valid image upload', async () => {
    // 1x1 red PNG
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    );

    const boundary = '----formdata-boundary';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="avatar.png"\r\n`),
      Buffer.from(`Content-Type: image/png\r\n\r\n`),
      pngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/users/me/avatar',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);
    expect(result).toHaveProperty('avatarUrl');
    expect(result.avatarUrl).toContain('s3');
  });

  it('rejects invalid mimetype', async () => {
    const boundary = '----formdata-boundary';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="malware.exe"\r\n`),
      Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
      Buffer.from('not an image'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/users/me/avatar',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    const result = JSON.parse(res.body);
    expect(result.error).toContain('Invalid file type');
  });
});

describe('PATCH /api/users/me', () => {
  it('updates name successfully', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { name: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id', 'user-1');
  });

  it('updates preferences successfully', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { preferences: { theme: 'dark', locale: 'en' } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
  });

  it('updates multiple fields at once', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { name: 'Updated', avatarUrl: 'https://example.com/avatar.png' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('clears avatarUrl with null', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { avatarUrl: null },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects empty body', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid name (empty string)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects name exceeding max length', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      payload: { name: 'x'.repeat(256) },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/users/me/avatar', () => {
  it('returns 404 when no avatar exists', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/users/me/avatar' });
    expect(res.statusCode).toBe(404);
  });
});
