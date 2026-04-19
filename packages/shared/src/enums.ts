export const TicketStatus = {
  BACKLOG: 'backlog',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  QA: 'qa',
  ACCEPTANCE: 'acceptance',
  DONE: 'done',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TICKET_STATUS_ORDER: TicketStatus[] = [
  TicketStatus.BACKLOG,
  TicketStatus.IN_PROGRESS,
  TicketStatus.REVIEW,
  TicketStatus.QA,
  TicketStatus.ACCEPTANCE,
  TicketStatus.DONE,
];

export const TicketPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const FeatureStatus = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
} as const;

export type FeatureStatus = (typeof FeatureStatus)[keyof typeof FeatureStatus];

export const PersonaType = {
  PLANNER: 'planner',
  DEVELOPER: 'developer',
  PRODUCT: 'product',
  BUSINESS_RULES: 'business_rules',
  QA: 'qa',
  RESEARCHER: 'researcher',
  ORCHESTRATOR: 'orchestrator',
  IMPLEMENTER: 'implementer',
  REVIEWER: 'reviewer',
  QA_TESTER: 'qa_tester',
  ACCEPTANCE_VALIDATOR: 'acceptance_validator',
} as const;

export type PersonaType = (typeof PersonaType)[keyof typeof PersonaType];

export const PersonaPhase = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
} as const;

export type PersonaPhase = (typeof PersonaPhase)[keyof typeof PersonaPhase];

export const AgentSessionStatus = {
  PENDING: 'pending',
  STARTING: 'starting',
  RUNNING: 'running',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AgentSessionStatus = (typeof AgentSessionStatus)[keyof typeof AgentSessionStatus];

export const AgentActivity = {
  BUSY: 'busy',
  WAITING: 'waiting',
  IDLE: 'idle',
} as const;

export type AgentActivity = (typeof AgentActivity)[keyof typeof AgentActivity];

export const GateResult = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type GateResult = (typeof GateResult)[keyof typeof GateResult];

export const ProjectRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export const ProposalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EDITED: 'edited',
} as const;

export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const ChatSessionStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

export type ChatSessionStatus = (typeof ChatSessionStatus)[keyof typeof ChatSessionStatus];

export const RepoWorkspaceStatus = {
  CLONING: 'cloning',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type RepoWorkspaceStatus = (typeof RepoWorkspaceStatus)[keyof typeof RepoWorkspaceStatus];

export const AttentionItemType = {
  TRANSITION_GATE: 'transition_gate',
  FAILED_SESSION: 'failed_session',
  HUMAN_ESCALATION: 'human_escalation',
  STUCK_TICKET: 'stuck_ticket',
  PROPOSAL_REVIEW: 'proposal_review',
} as const;

export type AttentionItemType = (typeof AttentionItemType)[keyof typeof AttentionItemType];

export const AttentionItemStatus = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;

export type AttentionItemStatus = (typeof AttentionItemStatus)[keyof typeof AttentionItemStatus];

export const NotificationType = {
  AGENT_COMPLETED: 'agent_completed',
  TICKET_MOVED: 'ticket_moved',
  GATE_RESULT: 'gate_result',
  COMMENT_ADDED: 'comment_added',
  PROPOSAL_CREATED: 'proposal_created',
  PROPOSAL_RESOLVED: 'proposal_resolved',
  SCAN_COMPLETED: 'scan_completed',
  HANDOFF_RECEIVED: 'handoff_received',
  HANDOFF_COMPLETED: 'handoff_completed',
  HANDOFF_FAILED: 'handoff_failed',
  HANDOFF_OVERRIDE_CREATED: 'handoff_override_created',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
