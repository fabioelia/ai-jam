import type { ChatSessionStatus, ProposalStatus } from '../enums.js';

export interface ChatSession {
  id: string;
  featureId: string;
  userId: string;
  ptyInstanceId: string | null;
  status: ChatSessionStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatSessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredActions: StructuredAction[] | null;
  createdAt: string;
}

export interface StructuredAction {
  type: 'PROPOSE_TICKETS' | 'PROPOSE_EPIC' | 'UPDATE_TICKET';
  data: unknown;
}

export interface TicketProposal {
  id: string;
  chatSessionId: string;
  featureId: string;
  proposedByMessageId: string | null;
  status: ProposalStatus;
  ticketData: ProposedTicketData;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProposedTicketData {
  title: string;
  description: string;
  epicTitle?: string;
  priority: string;
  storyPoints?: number;
  acceptanceCriteria?: string[];
}

export interface CreateChatSessionRequest {
  featureId: string;
}

export interface SendChatMessageRequest {
  content: string;
}
