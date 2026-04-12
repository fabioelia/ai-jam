import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { updateProfileSchema } from '@ai-jam/shared';
import {
  validateAvatarMimetype,
  resizeAvatar,
  uploadAvatarToS3,
  deleteAvatarFromS3,
} from '../services/avatar-service.js';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // GET /api/users/me — current user profile
  fastify.get('/api/users/me', async (request, reply) => {
    const { userId } = request.user;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  // PATCH /api/users/me — update profile (name, avatar, preferences)
  fastify.patch('/api/users/me', async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { userId } = request.user;
    const { name, avatarUrl, preferences } = parsed.data;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (preferences !== undefined) updates.preferences = preferences;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }

    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) return reply.status(404).send({ error: 'User not found' });
    return updated;
  });

  // POST /api/users/me/avatar — upload avatar image
  fastify.post('/api/users/me/avatar', async (request, reply) => {
    const { userId } = request.user;

    let file;
    try {
      file = await request.file();
    } catch {
      return reply.status(400).send({ error: 'Expected multipart file upload' });
    }

    if (!file) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    if (!validateAvatarMimetype(file.mimetype)) {
      return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' });
    }

    const buffer = await file.toBuffer();

    const resized = await resizeAvatar(buffer);
    const avatarUrl = await uploadAvatarToS3(userId, resized);

    // Delete old avatar if one exists
    const [current] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (current?.avatarUrl) {
      await deleteAvatarFromS3(current.avatarUrl);
    }

    const [updated] = await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updated;
  });

  // DELETE /api/users/me/avatar — remove avatar
  fastify.delete('/api/users/me/avatar', async (request, reply) => {
    const { userId } = request.user;

    const [current] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!current?.avatarUrl) {
      return reply.status(404).send({ error: 'No avatar to delete' });
    }

    await deleteAvatarFromS3(current.avatarUrl);

    const [updated] = await db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updated;
  });
}
