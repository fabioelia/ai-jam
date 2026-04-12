import type { TicketStatus, TicketPriority, GateResult, AttentionItemType, AttentionItemStatus } from '../enums.js';

export interface Epic {
  id: string;
  featureId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  epicId: string | null;
  featureId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  sortOrder: number;
  storyPoints: number | null;
  assignedPersona: string | null;
  assignedUserId: string | null;
  createdBy: string;
  source: 'human' | 'mcp' | 'api';
  createdAt: string;
  updatedAt: string;
}

export interface TicketNote {
  id: string;
  ticketId: string;
  authorType: 'user' | 'agent';
  authorId: string;
  content: string;
  fileUris: string[];
  handoffFrom: string | null;
  handoffTo: string | null;
  source: 'human' | 'mcp' | 'api';
  createdAt: string;
}

export interface Comment {
  id: string;
  ticketId: string;
  userId: string;
  body: string;
  source: 'human' | 'mcp' | 'api';
  createdAt: string;
  updatedAt: string;
}

export interface TransitionGate {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  gatekeeperPersona: string;
  result: GateResult;
  feedback: string | null;
  agentSessionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AttentionItem {
  id: string;
  projectId: string;
  featureId: string | null;
  ticketId: string | null;
  type: AttentionItemType;
  status: AttentionItemStatus;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface BoardColumn {
  status: TicketStatus;
  tickets: Ticket[];
}

export interface BoardState {
  columns: BoardColumn[];
  epics: Epic[];
}

export interface CreateTicketRequest {
  title: string;
  description?: string;
  epicId?: string;
  priority?: TicketPriority;
  storyPoints?: number;
}

export interface MoveTicketRequest {
  toStatus: TicketStatus;
  sortOrder?: number;
}

export interface CreateCommentRequest {
  body: string;
}

export interface CreateEpicRequest {
  title: string;
  description?: string;
  color?: string;
}
