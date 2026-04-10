import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  repoUrl: varchar('repo_url', { length: 512 }).notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).default('main').notNull(),
  githubTokenEncrypted: text('github_token_encrypted'),
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
  assignedPersona: varchar('assigned_persona', { length: 100 }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Comments (user comments on tickets)
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
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
