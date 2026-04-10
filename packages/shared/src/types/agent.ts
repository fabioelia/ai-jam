import type { AgentSessionStatus, AgentActivity } from '../enums.js';

export interface AgentSession {
  id: string;
  ticketId: string | null;
  personaType: string;
  ptyInstanceId: string | null;
  status: AgentSessionStatus;
  activity: AgentActivity;
  prompt: string | null;
  outputSummary: string | null;
  workingDirectory: string | null;
  costTokensIn: number;
  costTokensOut: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface HandoffRecord {
  id: string;
  ticketId: string;
  sourcePersona: string;
  targetPersona: string;
  summary: string;
  directive: string;
  findings: HandoffFinding[];
  artifacts: HandoffArtifact[];
  createdAt: string;
}

export interface HandoffFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  category: string;
  description: string;
  fileRef?: string;
}

export interface HandoffArtifact {
  type: 'pr' | 'comment' | 'file' | 'test_report';
  ref: string;
  description: string;
}
