import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../config.js', () => ({
  config: { jwtSecret: 'test-secret' },
}));
vi.mock('../agent-runtime/runtime-manager.js', () => ({
  getRuntimeClient: vi.fn(),
}));
vi.mock('../agent-runtime/pty-daemon-manager.js', () => ({
  getPtyDaemonClient: vi.fn(),
}));

import jwt from 'jsonwebtoken';

// Capture the connection handler and middleware registered by setupSocketServer
let authMiddleware: (socket: unknown, next: (err?: Error) => void) => void;
let connectionHandler: (socket: unknown) => void;

const mockToEmit = vi.fn();
const mockTo = vi.fn(() => ({ emit: mockToEmit }));

vi.mock('socket.io', () => {
  class MockServer {
    use(fn: typeof authMiddleware) {
      authMiddleware = fn;
    }
    on(event: string, handler: typeof connectionHandler) {
      if (event === 'connection') connectionHandler = handler;
    }
    to = mockTo;
  }
  return { Server: MockServer };
});

import { setupSocketServer, broadcastToUser } from './socket-server.js';
import { createServer } from 'http';

function makeSocket(overrides: Record<string, unknown> = {}) {
  const rooms = new Set<string>();
  return {
    handshake: { auth: { token: overrides.token ?? '' } },
    data: overrides.data ?? {},
    join: vi.fn((room: string) => rooms.add(room)),
    leave: vi.fn((room: string) => rooms.delete(room)),
    on: vi.fn(),
    rooms,
  };
}

describe('socket-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSocketServer(createServer());
  });

  describe('auth middleware', () => {
    it('rejects connection without token', () => {
      const socket = makeSocket({ token: undefined });
      const next = vi.fn();
      authMiddleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication required' }));
    });

    it('rejects connection with invalid token', () => {
      const socket = makeSocket({ token: 'bad-token' });
      const next = vi.fn();
      authMiddleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });

    it('sets userId and email on socket.data for valid token', () => {
      const token = jwt.sign({ userId: 'u1', email: 'u1@test.com' }, 'test-secret');
      const socket = makeSocket({ token });
      const next = vi.fn();
      authMiddleware(socket, next);
      expect(next).toHaveBeenCalledWith();
      expect(socket.data).toMatchObject({ userId: 'u1', email: 'u1@test.com' });
    });
  });

  describe('connection handler', () => {
    it('auto-joins user:{userId} room on connection', () => {
      const socket = makeSocket({ data: { userId: 'u1' } });
      connectionHandler(socket);
      expect(socket.join).toHaveBeenCalledWith('user:u1');
    });

    it('does not auto-join if userId missing', () => {
      const socket = makeSocket({ data: {} });
      connectionHandler(socket);
      // join should not be called for user room (no userId)
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('registers join:user and leave:user handlers', () => {
      const socket = makeSocket({ data: { userId: 'u1' } });
      connectionHandler(socket);

      const handlers = Object.fromEntries(
        socket.on.mock.calls.map((call: unknown[]) => [call[0], call[1]])
      );

      expect(handlers['join:user']).toBeDefined();
      expect(handlers['leave:user']).toBeDefined();

      // Test join:user handler
      (handlers['join:user'] as (d: { userId: string }) => void)({ userId: 'u2' });
      expect(socket.join).toHaveBeenCalledWith('user:u2');

      // Test leave:user handler
      (handlers['leave:user'] as (d: { userId: string }) => void)({ userId: 'u2' });
      expect(socket.leave).toHaveBeenCalledWith('user:u2');
    });
  });

  describe('broadcastToUser', () => {
    it('emits to user:{userId} room', () => {
      broadcastToUser('u1', 'notification:created', { notification: { id: 'n1' } });
      expect(mockTo).toHaveBeenCalledWith('user:u1');
      expect(mockToEmit).toHaveBeenCalledWith('notification:created', { notification: { id: 'n1' } });
    });
  });
});
