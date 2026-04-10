import type { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects, projectMembers } from '../db/schema.js';
import { createProjectSchema } from '@ai-jam/shared';
import { ensureWorkspace } from '../services/repo-workspace.js';

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List user's projects
  fastify.get('/api/projects', async (request) => {
    const { userId } = request.user;
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
    const { name, repoUrl, defaultBranch, githubToken } = parsed.data;

    const [project] = await db.insert(projects).values({
      name,
      repoUrl,
      defaultBranch: defaultBranch || 'main',
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
    if (project.repoUrl && project.githubTokenEncrypted) {
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

    const [project] = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, request.params.id)).returning();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  // Delete project
  fastify.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const result = await db.delete(projects).where(eq(projects.id, request.params.id)).returning();
    if (result.length === 0) return reply.status(404).send({ error: 'Project not found' });
    return { ok: true };
  });
}
