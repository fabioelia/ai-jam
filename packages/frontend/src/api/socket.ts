import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@ai-jam/shared';
import { useAuthStore } from '../stores/auth-store.js';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (socket?.connected) return socket;

  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('No auth token for socket');

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
  }) as TypedSocket;

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    if (err.message === 'Invalid token') {
      // Token expired — disconnect, will reconnect after refresh
      socket?.disconnect();
      socket = null;
    }
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinBoard(projectId: string) {
  const s = getSocket();
  s.emit('join:board', { projectId });
}

export function leaveBoard(projectId: string) {
  socket?.emit('leave:board', { projectId });
}

export function joinTicket(ticketId: string) {
  const s = getSocket();
  s.emit('join:ticket', { ticketId });
}

export function leaveTicket(ticketId: string) {
  socket?.emit('leave:ticket', { ticketId });
}

export function joinFeature(featureId: string) {
  const s = getSocket();
  s.emit('join:feature', { featureId });
}

export function leaveFeature(featureId: string) {
  socket?.emit('leave:feature', { featureId });
}

export function attachPty(sessionId: string) {
  const s = getSocket();
  s.emit('pty:attach', { sessionId });
}

export function detachPty(sessionId: string) {
  socket?.emit('pty:detach', { sessionId });
}

export function sendPtyInput(sessionId: string, data: string) {
  socket?.emit('pty:input', { sessionId, data });
}

export function resizePty(sessionId: string, cols: number, rows: number) {
  socket?.emit('pty:resize', { sessionId, cols, rows });
}
