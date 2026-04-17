import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  repoUrl: z.string().optional(),
  localPath: z.string().optional(),
  defaultBranch: z.string().max(255).optional().default('main'),
  supportWorktrees: z.boolean().optional().default(true),
  githubToken: z.string().optional(),
}).refine(
  (data) => data.repoUrl || data.localPath,
  { message: 'Either repoUrl or localPath is required', path: ['repoUrl'] },
);

export const createFeatureSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  repoBranch: z.string().max(255).optional(),
});

export const createTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  epicId: z.string().uuid().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional().default('medium'),
  storyPoints: z.number().int().positive().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
});

export const moveTicketSchema = z.object({
  toStatus: z.enum(['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done']),
  sortOrder: z.number().int().optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  epicId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().positive().nullable().optional(),
  assignedPersona: z.string().max(100).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1),
});

export const createEpicSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateEpicSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().max(512).nullable().optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const createClaudeTicketSchema = z.object({
  userPrompt: z.string().min(10).max(10000),
  projectId: z.string().uuid(),
  featureId: z.string().uuid(),
  attachments: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['image', 'document']),
    mimeType: z.string(),
    url: z.string(),
  })).default([]),
});

export const uploadAttachmentSchema = z.object({
  file: z.any(),
  type: z.enum(['image', 'document']).optional().default('document'),
});
