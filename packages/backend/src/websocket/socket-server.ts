import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import { getPtyDaemonClient } from '../agent-runtime/pty-daemon-manager.js';
import type { ServerToClientEvents, ClientToServerEvents, Notification } from '@ai-jam/shared';
import {
  setPresence,
  removePresence,
  removeAllPresence,
  getUsersInContext,
  setTyping,
  clearTyping,
} from './presence-store.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

export function setupSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: string; email: string };
      (socket.data as Record<string, unknown>).userId = payload.userId;
      (socket.data as Record<string, unknown>).email = payload.email;

      // Look up name and avatar for presence system
      const [user] = await db
        .select({ name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      if (user) {
        (socket.data as Record<string, unknown>).userName = user.name;
        (socket.data as Record<string, unknown>).avatarUrl = user.avatarUrl;
      }
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Auto-join user-specific room so notifications reach this user on any page
    const userId = socket.data.userId as string;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join:user', ({ userId }) => {
      socket.join(`user:${userId}`);
    });

    socket.on('leave:user', ({ userId }) => {
      socket.leave(`user:${userId}`);
    });

    socket.on('join:board', ({ projectId }) => {
      socket.join(`board:${projectId}`);
    });

    socket.on('leave:board', ({ projectId }) => {
      socket.leave(`board:${projectId}`);
    });

    socket.on('join:ticket', ({ ticketId }) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('leave:ticket', ({ ticketId }) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on('join:feature', ({ featureId }) => {
      socket.join(`feature:${featureId}`);
    });

    socket.on('leave:feature', ({ featureId }) => {
      socket.leave(`feature:${featureId}`);
    });

    // Presence
    socket.on('presence:viewing', ({ context, contextId }) => {
      const userId = socket.data.userId as string;
      const userName = (socket.data as Record<string, unknown>).userName as string ?? '';
      const avatarUrl = (socket.data as Record<string, unknown>).avatarUrl as string | null ?? null;
      const room = `${context}:${contextId}`;
      if (!socket.rooms.has(room)) socket.join(room);

      const users = setPresence({ userId, userName, avatarUrl, context, contextId });
      io!.to(room).emit('presence:update', { context, contextId, users });
    });

    socket.on('presence:leaving', ({ context, contextId }) => {
      const userId = socket.data.userId as string;
      const room = `${context}:${contextId}`;
      if (socket.rooms.has(room)) socket.leave(room);

      const users = removePresence(userId, context, contextId);
      if (users.length > 0 || true) {
        io!.to(room).emit('presence:update', { context, contextId, users });
      }
    });

    // Typing
    socket.on('typing:start', ({ ticketId }) => {
      const userId = socket.data.userId as string;
      const userName = (socket.data as Record<string, unknown>).userName as string ?? '';
      const room = `ticket:${ticketId}`;
      if (!socket.rooms.has(room)) socket.join(room);
      setTyping(userId, userName, ticketId);
      io!.to(room).emit('typing:indicator', { ticketId, userId, userName, isTyping: true });
    });

    socket.on('typing:stop', ({ ticketId }) => {
      const userId = socket.data.userId as string;
      clearTyping(userId, ticketId);
      io!.to(`ticket:${ticketId}`).emit('typing:indicator', { ticketId, userId, userName: (socket.data as Record<string, unknown>).userName as string ?? '', isTyping: false });
    });

    // Terminal I/O: user sends keystrokes to a PTY session.
    // Try pty-daemon first (interactive sessions), fall back to agent-runtime.
    socket.on('pty:input', async ({ sessionId, data }) => {
      try {
        const ptyClient = getPtyDaemonClient();
        if (ptyClient.isConnected) {
          await ptyClient.writeToSession(sessionId, data);
          return;
        }
      } catch { /* not in pty-daemon */ }
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          await client.writeToSession(sessionId, data);
        }
      } catch { /* session not found — expected after restarts */ }
    });

    // Terminal resize — try pty-daemon first, fall back to agent-runtime
    socket.on('pty:resize', async ({ sessionId, cols, rows }) => {
      try {
        const ptyClient = getPtyDaemonClient();
        if (ptyClient.isConnected) {
          await ptyClient.resizeSession(sessionId, cols, rows);
          return;
        }
      } catch { /* not in pty-daemon */ }
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          await client.resizeSession(sessionId, cols, rows);
        }
      } catch { /* session not found — expected after restarts */ }
    });

    // Join a terminal session room to receive PTY output.
    // Try pty-daemon first for buffer replay, fall back to agent-runtime.
    socket.on('pty:attach', async ({ sessionId }) => {
      socket.join(`pty:${sessionId}`);

      // Replay buffered output so the client sees everything from session start
      try {
        const ptyClient = getPtyDaemonClient();
        if (ptyClient.isConnected) {
          const buffer = await ptyClient.getSessionBuffer(sessionId);
          if (buffer) {
            socket.emit('pty:data', { sessionId, data: buffer });
            return;
          }
        }
      } catch { /* not in pty-daemon */ }
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          const buffer = await client.getSessionBuffer(sessionId);
          if (buffer) {
            socket.emit('pty:data', { sessionId, data: buffer });
          }
        }
      } catch { /* session not found — expected after restarts */ }
    });

    socket.on('pty:detach', ({ sessionId }) => {
      socket.leave(`pty:${sessionId}`);
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const userId = socket.data.userId as string;
      const affectedKeys = removeAllPresence(userId);

      // Re-broadcast updated presence for affected contexts
      for (const key of affectedKeys) {
        const parts = key.split(':');
        const context = parts[0];
        const contextId = parts.slice(1).join(':');
        const users = getUsersInContext(context, contextId);
        io!.to(key).emit('presence:update', { context, contextId, users });
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function broadcastToUser(userId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event as keyof ServerToClientEvents, data as never);
}

export function broadcastToBoard(projectId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`board:${projectId}`).emit(event as keyof ServerToClientEvents, data as never);
}

export function broadcastToTicket(ticketId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event as keyof ServerToClientEvents, data as never);
}

export function broadcastToFeature(featureId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`feature:${featureId}`).emit(event as keyof ServerToClientEvents, data as never);
}

export function broadcastToPty(sessionId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`pty:${sessionId}`).emit(event as keyof ServerToClientEvents, data as never);
}

// Notification broadcasts — all go to board:${projectId} room
export function broadcastNotificationCreated(projectId: string, notification: Notification) {
  if (!io) return;
  io.to(`board:${projectId}`).emit('notification:created', { notification });
}

export function broadcastNotificationRead(projectId: string, notificationId: string, userId: string) {
  if (!io) return;
  io.to(`board:${projectId}`).emit('notification:read', { notificationId, userId });
}

export function broadcastNotificationCount(projectId: string, userId: string, count: number) {
  if (!io) return;
  io.to(`board:${projectId}`).emit('notification:count', { projectId, userId, count });
}
