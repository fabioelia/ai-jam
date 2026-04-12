import type { Ticket, Epic, Comment, TransitionGate, AttentionItem } from './board.js';
import type { AttentionItemStatus } from '../enums.js';
import type { AgentActivity } from '../enums.js';
import type { Notification } from './notification.js';

// Server -> Client events
export interface ServerToClientEvents {
  // Board events
  'board:ticket:created': (data: { ticket: Ticket }) => void;
  'board:ticket:updated': (data: { ticketId: string; changes: Partial<Ticket> }) => void;
  'board:ticket:moved': (data: { ticketId: string; fromStatus: string; toStatus: string; sortOrder: number }) => void;
  'board:ticket:deleted': (data: { ticketId: string }) => void;
  'board:epic:created': (data: { epic: Epic }) => void;
  'board:epic:updated': (data: { epicId: string; changes: Partial<Epic> }) => void;

  // Agent events
  'agent:session:started': (data: { sessionId: string; ticketId: string | null; personaType: string }) => void;
  'agent:session:activity': (data: { sessionId: string; activity: AgentActivity }) => void;
  'agent:session:output': (data: { sessionId: string; chunk: string }) => void;
  'agent:session:completed': (data: { sessionId: string; summary: string | null }) => void;
  'agent:handoff': (data: { ticketId: string; fromPersona: string; toPersona: string; note: string }) => void;
  'agent:gate:result': (data: { ticketId: string; gate: TransitionGate }) => void;

  // Planning chat events
  'chat:message': (data: { sessionId: string; role: string; content: string; structuredActions?: unknown }) => void;
  'proposal:created': (data: { proposalId: string; ticketData: unknown }) => void;
  'proposal:approved': (data: { proposalId: string; ticketId: string }) => void;
  'proposal:rejected': (data: { proposalId: string }) => void;

  // Comment events
  'comment:created': (data: { comment: Comment }) => void;

  // Notification events
  'notification:created': (data: { notification: Notification }) => void;
  'notification:read': (data: { notificationId: string; userId: string }) => void;
  'notification:read-all': (data: { userId: string; projectId?: string }) => void;
  'notification:count': (data: { projectId: string; userId: string; count: number }) => void;

  // Attention events
  'attention:created': (data: { item: AttentionItem }) => void;
  'attention:resolved': (data: { itemId: string; status: AttentionItemStatus }) => void;
  'attention:count': (data: { count: number }) => void;

  // Terminal PTY events
  'pty:data': (data: { sessionId: string; data: string }) => void;
}

// Client -> Server events
export interface ClientToServerEvents {
  'join:user': (data: { userId: string }) => void;
  'leave:user': (data: { userId: string }) => void;
  'join:board': (data: { projectId: string }) => void;
  'leave:board': (data: { projectId: string }) => void;
  'join:ticket': (data: { ticketId: string }) => void;
  'leave:ticket': (data: { ticketId: string }) => void;
  'join:feature': (data: { featureId: string }) => void;
  'leave:feature': (data: { featureId: string }) => void;

  // Terminal PTY events
  'pty:attach': (data: { sessionId: string }) => void;
  'pty:detach': (data: { sessionId: string }) => void;
  'pty:input': (data: { sessionId: string; data: string }) => void;
  'pty:resize': (data: { sessionId: string; cols: number; rows: number }) => void;
}
