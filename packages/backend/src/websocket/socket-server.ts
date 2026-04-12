import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import type { ServerToClientEvents, ClientToServerEvents, Notification } from '@ai-jam/shared';

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
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
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

    // Terminal I/O: user sends keystrokes to a PTY session
    socket.on('pty:input', async ({ sessionId, data }) => {
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          await client.writeToSession(sessionId, data);
        }
      } catch {
        // Session not found in runtime — expected after restarts
      }
    });

    // Terminal resize — silently ignore if session no longer exists in runtime
    socket.on('pty:resize', async ({ sessionId, cols, rows }) => {
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          await client.resizeSession(sessionId, cols, rows);
        }
      } catch {
        // Session not found in runtime — expected after restarts
      }
    });

    // Join a terminal session room to receive PTY output
    socket.on('pty:attach', async ({ sessionId }) => {
      socket.join(`pty:${sessionId}`);

      // Replay buffered output so the client sees everything from session start
      try {
        const client = getRuntimeClient();
        if (client.isConnected) {
          const buffer = await client.getSessionBuffer(sessionId);
          if (buffer) {
            socket.emit('pty:data', { sessionId, data: buffer });
          }
        }
      } catch {
        // Session not found in runtime — expected after restarts
      }
    });

    socket.on('pty:detach', ({ sessionId }) => {
      socket.leave(`pty:${sessionId}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
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
