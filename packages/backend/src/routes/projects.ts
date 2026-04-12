import type { FastifyInstance } from 'fastify';
import { eq, or, desc, and, sql, count, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects, projectMembers, users, features, chatSessions, agentSessions, tickets, ticketProposals, chatMessages } from '../db/schema.js';
import { createProjectSchema } from '@ai-jam/shared';
import { ensureWorkspace } from '../services/repo-workspace.js';

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List user's projects (service user sees all)
  fastify.get('/api/projects', async (request) => {
    const { userId } = request.user;
    const isService = userId === (process.env.AIJAM_SERVICE_USER_ID || '');

    if (isService) {
      return db.select().from(projects);
    }

    const rows = await db
      .select({ project: projects })
      .from(projects)
      .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)));

    return rows.map((r) => r.project);
  });

  // Create project
  fastify.post('/api/projects', async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { userId } = request.user;
    const { name, repoUrl, localPath, defaultBranch, supportWorktrees, githubToken } = parsed.data;

    const [project] = await db.insert(projects).values({
      name,
      repoUrl: repoUrl || null,
      localPath: localPath || null,
      defaultBranch: defaultBranch || 'main',
      supportWorktrees: supportWorktrees === false ? 0 : 1,
      githubTokenEncrypted: githubToken || null,
      ownerId: userId,
    }).returning();

    // Add owner as member
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId,
      role: 'owner',
    });

    // Clone repo in background (don't block the response)
    if (project.repoUrl) {
      ensureWorkspace(project.id).catch((err) => {
        console.error(`[projects] Background clone failed for ${project.id}:`, err.message);
      });
    }

    return project;
  });

  // Get single project
  fastify.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, request.params.id)).limit(1);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  // Update project
  fastify.patch<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.defaultBranch === 'string') updates.defaultBranch = body.defaultBranch;
    if (typeof body.githubToken === 'string') updates.githubTokenEncrypted = body.githubToken;
    if (typeof body.localPath === 'string') updates.localPath = body.localPath || null;
    if (typeof body.supportWorktrees === 'boolean') updates.supportWorktrees = body.supportWorktrees ? 1 : 0;
    if (body.personaModelOverrides && typeof body.personaModelOverrides === 'object') {
      updates.personaModelOverrides = body.personaModelOverrides;
    }

    const [project] = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, request.params.id)).returning();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  // Delete project
  fastify.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    // Verify project exists and user owns it
    const [project] = await db.select().from(projects).where(eq(projects.id, request.params.id)).limit(1);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const { userId } = request.user;
    const isService = userId === (process.env.AIJAM_SERVICE_USER_ID || '');
    if (project.ownerId !== userId && !isService) {
      return reply.status(403).send({ error: 'Only the project owner can delete it' });
    }

    await db.delete(projects).where(eq(projects.id, request.params.id));
    return { ok: true };
  });

  // List all users (for member picker)
  fastify.get('/api/users', async () => {
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
      .from(users);
    return rows;
  });

  // List project members
  fastify.get<{ Params: { id: string } }>('/api/projects/:id/members', async (request) => {
    const rows = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, request.params.id));
    return rows;
  });

  // Add project member
  fastify.post<{ Params: { id: string } }>('/api/projects/:id/members', async (request, reply) => {
    const { userId, role } = request.body as { userId: string; role?: string };
    if (!userId) return reply.status(400).send({ error: 'userId is required' });

    // Check user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    // Check not already a member
    const existing = await db.select().from(projectMembers)
      .where(and(eq(projectMembers.projectId, request.params.id), eq(projectMembers.userId, userId)))
      .limit(1);
    if (existing.length > 0) return reply.status(409).send({ error: 'User is already a member' });

    await db.insert(projectMembers).values({
      projectId: request.params.id,
      userId,
      role: role || 'member',
    });

    return { ok: true };
  });

  // Remove project member
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/api/projects/:id/members/:userId',
    async (request, reply) => {
      const { id: projectId, userId } = request.params;

      // Don't allow removing the owner
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (project && project.ownerId === userId) {
        return reply.status(400).send({ error: 'Cannot remove the project owner' });
      }

      await db.delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
      return { ok: true };
    }
  );

  // List all sessions for a project (chat + agent sessions)
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/sessions',
    async (request) => {
      const { projectId } = request.params;

      // Chat sessions (planning) — joined through features
      const chatRows = await db
        .select({
          id: chatSessions.id,
          featureId: chatSessions.featureId,
          featureTitle: features.title,
          status: chatSessions.status,
          createdAt: chatSessions.createdAt,
        })
        .from(chatSessions)
        .innerJoin(features, eq(features.id, chatSessions.featureId))
        .where(eq(features.projectId, projectId))
        .orderBy(desc(chatSessions.createdAt));

      // Enrich planning sessions with proposal counts, message stats
      const sessionIds = chatRows.map((r) => r.id);

      const proposalMap = new Map<string, { approved: number; total: number }>();
      const messageMap = new Map<string, { count: number; lastActivityAt: string | Date; lastActorRole: string | null }>();

      if (sessionIds.length > 0) {
        const [proposalCounts, messageCounts, lastActors] = await Promise.all([
          db
            .select({
              chatSessionId: ticketProposals.chatSessionId,
              total: count(),
              approved: sql<number>`count(*) filter (where ${ticketProposals.status} = 'approved')`,
            })
            .from(ticketProposals)
            .where(inArray(ticketProposals.chatSessionId, sessionIds))
            .groupBy(ticketProposals.chatSessionId),

          db
            .select({
              chatSessionId: chatMessages.chatSessionId,
              messageCount: count(),
              lastActivityAt: sql<string>`max(${chatMessages.createdAt})`,
            })
            .from(chatMessages)
            .where(inArray(chatMessages.chatSessionId, sessionIds))
            .groupBy(chatMessages.chatSessionId),

          db
            .selectDistinctOn([chatMessages.chatSessionId], {
              chatSessionId: chatMessages.chatSessionId,
              role: chatMessages.role,
            })
            .from(chatMessages)
            .where(inArray(chatMessages.chatSessionId, sessionIds))
            .orderBy(chatMessages.chatSessionId, desc(chatMessages.createdAt)),
        ]);

        for (const row of proposalCounts) {
          proposalMap.set(row.chatSessionId, { approved: row.approved, total: row.total });
        }
        for (const row of messageCounts) {
          const lastActor = lastActors.find((a) => a.chatSessionId === row.chatSessionId);
          messageMap.set(row.chatSessionId, {
            count: row.messageCount,
            lastActivityAt: row.lastActivityAt,
            lastActorRole: lastActor?.role ?? null,
          });
        }
      }

      // Agent sessions (execution) — joined through tickets → features
      const agentRows = await db
        .select({
          id: agentSessions.id,
          ticketId: agentSessions.ticketId,
          ticketTitle: tickets.title,
          featureId: tickets.featureId,
          featureTitle: features.title,
          personaType: agentSessions.personaType,
          status: agentSessions.status,
          activity: agentSessions.activity,
          outputSummary: agentSessions.outputSummary,
          startedAt: agentSessions.startedAt,
          createdAt: agentSessions.createdAt,
          completedAt: agentSessions.completedAt,
        })
        .from(agentSessions)
        .innerJoin(tickets, eq(tickets.id, agentSessions.ticketId))
        .innerJoin(features, eq(features.id, tickets.featureId))
        .where(eq(tickets.projectId, projectId))
        .orderBy(desc(agentSessions.createdAt))
        .limit(50);

      // Scan sessions (no ticket, persona = repo_scanner)
      const scanRows = await db
        .select({
          id: agentSessions.id,
          personaType: agentSessions.personaType,
          status: agentSessions.status,
          activity: agentSessions.activity,
          outputSummary: agentSessions.outputSummary,
          createdAt: agentSessions.createdAt,
          completedAt: agentSessions.completedAt,
        })
        .from(agentSessions)
        .where(eq(agentSessions.personaType, 'repo_scanner'))
        .orderBy(desc(agentSessions.createdAt))
        .limit(10);

      return {
        planning: chatRows.map((r) => {
          const proposals = proposalMap.get(r.id);
          const messages = messageMap.get(r.id);
          return {
            id: r.id,
            type: 'planning' as const,
            featureId: r.featureId,
            featureTitle: r.featureTitle,
            status: r.status,
            createdAt: r.createdAt,
            approvedProposalCount: proposals?.approved ?? 0,
            totalProposalCount: proposals?.total ?? 0,
            messageCount: messages?.count ?? 0,
            lastActivityAt: messages?.lastActivityAt ?? r.createdAt,
            lastActorRole: messages?.lastActorRole ?? null,
          };
        }),
        execution: agentRows.map((r) => ({
          id: r.id,
          type: 'execution' as const,
          ticketId: r.ticketId,
          ticketTitle: r.ticketTitle,
          featureId: r.featureId,
          featureTitle: r.featureTitle,
          personaType: r.personaType,
          status: r.status,
          activity: r.activity,
          outputSummary: r.outputSummary,
          startedAt: r.startedAt,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        })),
        scans: scanRows.map((r) => ({
          id: r.id,
          type: 'scan' as const,
          personaType: r.personaType,
          status: r.status,
          activity: r.activity,
          outputSummary: r.outputSummary,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        })),
      };
    }
  );
}
