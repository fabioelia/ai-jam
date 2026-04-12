import type { FastifyInstance } from 'fastify';
import { eq, and, isNull, gt } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { users, passwordResetTokens, refreshTokens } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '@ai-jam/shared';
import { config } from '../config.js';
import jwt from 'jsonwebtoken';

async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
}

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
    const refreshToken = jwt.sign({ ...payload, jti: crypto.randomUUID() }, config.jwtRefreshSecret, { expiresIn: '7d' });
    await storeRefreshToken(user.id, refreshToken);

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
    const refreshToken = jwt.sign({ ...payload, jti: crypto.randomUUID() }, config.jwtRefreshSecret, { expiresIn: '7d' });
    await storeRefreshToken(user.id, refreshToken);

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

      // Verify token exists in DB (not already used/revoked)
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const [stored] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!stored) {
        return reply.status(401).send({ error: 'Invalid refresh token' });
      }

      // Delete the old token (single-use)
      await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

      // Issue new token pair
      const newPayload = { userId: payload.userId, email: payload.email };
      const accessToken = fastify.jwt.sign(newPayload);
      const newRefreshToken = jwt.sign({ ...newPayload, jti: crypto.randomUUID() }, config.jwtRefreshSecret, { expiresIn: '7d' });
      await storeRefreshToken(payload.userId, newRefreshToken);

      return { accessToken, refreshToken: newRefreshToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // --- Password Reset Flow ---

  fastify.post('/api/auth/forgot-password', authRateLimit, async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email } = parsed.data;

    // Always return 200 to prevent email enumeration
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return { message: 'If that email is registered, a reset link has been sent.' };
    }

    // Generate a secure random token and store its hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // In production this sends an email. For now, log the reset URL.
    const resetUrl = `${config.frontendUrl}/reset-password?token=${rawToken}`;
    fastify.log.info({ resetUrl, userId: user.id }, 'Password reset requested');

    return { message: 'If that email is registered, a reset link has been sent.' };
  });

  fastify.post('/api/auth/reset-password', authRateLimit, async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { token, password } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid, unused, non-expired token
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!resetToken) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const newHash = await hashPassword(password);

    // Update password and mark token as used
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, resetToken.userId));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));

    return { message: 'Password has been reset successfully.' };
  });
}
