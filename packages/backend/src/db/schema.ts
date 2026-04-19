import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, primaryKey, unique } from 'drizzle-orm/pg-core';

// Enums
export const ticketStatusEnum = pgEnum('ticket_status', [
  'backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'critical', 'high', 'medium', 'low',
]);

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  preferences: jsonb('preferences').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  repoUrl: varchar('repo_url', { length: 512 }),
  localPath: varchar('local_path', { length: 1024 }),
  defaultBranch: varchar('default_branch', { length: 255 }).default('main').notNull(),
  supportWorktrees: integer('support_worktrees').default(1).notNull(),
  githubTokenEncrypted: text('github_token_encrypted'),
  personaModelOverrides: jsonb('persona_model_overrides').default({}).notNull(),
  transitionGates: jsonb('transition_gates').default({}).notNull(),
  maxRejectionCycles: integer('max_rejection_cycles').default(3).notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable('project_members', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).default('member').notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.userId] }),
]);

// Repo Workspaces
export const repoWorkspaces = pgTable('repo_workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').references(() => features.id, { onDelete: 'cascade' }),
  branch: varchar('branch', { length: 255 }).notNull(),
  localPath: varchar('local_path', { length: 1024 }).notNull(),
  status: varchar('status', { length: 50 }).default('cloning').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Features
export const features = pgTable('features', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  repoBranch: varchar('repo_branch', { length: 255 }),
  status: varchar('status', { length: 50 }).default('draft').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Chat Sessions (for planning conversations)
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  ptyInstanceId: varchar('pty_instance_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatSessionId: uuid('chat_session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  content: text('content').notNull(),
  structuredActions: jsonb('structured_actions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ticketProposals = pgTable('ticket_proposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatSessionId: uuid('chat_session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  proposedByMessageId: uuid('proposed_by_message_id').references(() => chatMessages.id),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  ticketData: jsonb('ticket_data').notNull(),
  /** Origin of this record: 'human' (UI), 'mcp' (agent tool), 'api' (direct API call) */
  source: varchar('source', { length: 20 }).default('human').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// Epics
export const epics = pgTable('epics', {
  id: uuid('id').defaultRandom().primaryKey(),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  color: varchar('color', { length: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tickets
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  epicId: uuid('epic_id').references(() => epics.id, { onDelete: 'set null' }),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: ticketStatusEnum('status').default('backlog').notNull(),
  priority: ticketPriorityEnum('priority').default('medium').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  storyPoints: integer('story_points'),
  acceptanceCriteria: jsonb('acceptance_criteria').default([]).notNull(),
  assignedPersona: varchar('assigned_persona', { length: 100 }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  /** Origin of this record: 'human' (UI), 'mcp' (agent tool), 'api' (direct API call) */
  source: varchar('source', { length: 20 }).default('human').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ticket Notes (agent handoffs + notes)
export const ticketNotes = pgTable('ticket_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorType: varchar('author_type', { length: 50 }).notNull(),
  authorId: varchar('author_id', { length: 255 }).notNull(),
  content: text('content').notNull(),
  fileUris: jsonb('file_uris').default([]).notNull(),
  handoffFrom: varchar('handoff_from', { length: 255 }),
  handoffTo: varchar('handoff_to', { length: 255 }),
  /** Origin of this record: 'human' (UI), 'mcp' (agent tool), 'api' (direct API call) */
  source: varchar('source', { length: 20 }).default('human').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Comments (user comments on tickets)
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  /** Origin of this record: 'human' (UI), 'mcp' (agent tool), 'api' (direct API call) */
  source: varchar('source', { length: 20 }).default('human').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Transition Gates
export const transitionGates = pgTable('transition_gates', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fromStatus: ticketStatusEnum('from_status').notNull(),
  toStatus: ticketStatusEnum('to_status').notNull(),
  gatekeeperPersona: varchar('gatekeeper_persona', { length: 100 }).notNull(),
  result: varchar('result', { length: 50 }).default('pending').notNull(),
  feedback: text('feedback'),
  agentSessionId: uuid('agent_session_id').references(() => agentSessions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// Agent Sessions
export const agentSessions = pgTable('agent_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  personaType: varchar('persona_type', { length: 100 }).notNull(),
  ptyInstanceId: varchar('pty_instance_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  activity: varchar('activity', { length: 50 }).default('idle').notNull(),
  prompt: text('prompt'),
  outputSummary: text('output_summary'),
  workingDirectory: varchar('working_directory', { length: 512 }),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(2).notNull(),
  costTokensIn: integer('cost_tokens_in').default(0).notNull(),
  costTokensOut: integer('cost_tokens_out').default(0).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// System Prompts (user-editable, per-project or global)
export const systemPrompts = pgTable('system_prompts', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  content: text('content').notNull(),
  isDefault: integer('is_default').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Project Scans (LLM-driven repo analysis)
export const projectScans = pgTable('project_scans', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  systemPromptId: uuid('system_prompt_id').references(() => systemPrompts.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  outputSummary: text('output_summary'),
  outputFiles: jsonb('output_files').default([]).notNull(),
  agentSessionId: varchar('agent_session_id', { length: 255 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').references(() => features.id, { onDelete: 'set null' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body'),
  actionUrl: varchar('action_url', { length: 1024 }),
  contextId: varchar('context_id', { length: 255 }),
  metadata: jsonb('metadata'),
  isRead: integer('is_read').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Refresh Tokens (for token rotation / revocation)
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification Preferences
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  enabled: integer('enabled').default(1).notNull(),
}, (table) => [
  unique('notification_preferences_user_project_type').on(table.userId, table.projectId, table.notificationType),
]);

// Attention Items (aggregated human intervention points)
export const attentionItemTypeEnum = pgEnum('attention_item_type', [
  'transition_gate', 'failed_session', 'human_escalation', 'stuck_ticket', 'proposal_review',
]);

export const attentionItemStatusEnum = pgEnum('attention_item_status', [
  'pending', 'resolved', 'dismissed',
]);

export const attentionItems = pgTable('attention_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').references(() => features.id, { onDelete: 'set null' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  type: attentionItemTypeEnum('type').notNull(),
  status: attentionItemStatusEnum('status').default('pending').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
});

// Persona Definitions (cached from .md files)
export const personaDefinitions = pgTable('persona_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  personaType: varchar('persona_type', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).default('sonnet').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  gatekeeperTransitions: jsonb('gatekeeper_transitions').default([]).notNull(),
  config: jsonb('config').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
