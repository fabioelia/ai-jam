import type { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { systemPrompts } from '../db/schema.js';

export async function systemPromptRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List global (default) system prompts
  fastify.get('/api/system-prompts', async () => {
    return db.select().from(systemPrompts).where(isNull(systemPrompts.projectId));
  });

  // List system prompts for a project (includes globals + project overrides)
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/system-prompts',
    async (request) => {
      const { projectId } = request.params;

      // Get global defaults
      const globals = await db.select().from(systemPrompts).where(isNull(systemPrompts.projectId));

      // Get project-specific overrides
      const projectSpecific = await db.select().from(systemPrompts)
        .where(eq(systemPrompts.projectId, projectId));

      // Merge: project overrides replace globals with same slug
      const overrideSlugs = new Set(projectSpecific.map((p) => p.slug));
      const merged = [
        ...globals.filter((g) => !overrideSlugs.has(g.slug)),
        ...projectSpecific,
      ];

      return merged;
    }
  );

  // Get a single system prompt
  fastify.get<{ Params: { id: string } }>(
    '/api/system-prompts/:id',
    async (request, reply) => {
      const [prompt] = await db.select().from(systemPrompts)
        .where(eq(systemPrompts.id, request.params.id));
      if (!prompt) return reply.status(404).send({ error: 'System prompt not found' });
      return prompt;
    }
  );

  // Create a project-specific system prompt (or override a global one)
  fastify.post<{ Params: { projectId: string }; Body: { slug: string; name: string; description?: string; content: string } }>(
    '/api/projects/:projectId/system-prompts',
    async (request) => {
      const { projectId } = request.params;
      const { slug, name, description, content } = request.body;

      const [prompt] = await db.insert(systemPrompts).values({
        projectId,
        slug,
        name,
        description: description || null,
        content,
      }).returning();

      return prompt;
    }
  );

  // Update a system prompt
  fastify.patch<{ Params: { id: string }; Body: { name?: string; description?: string; content?: string } }>(
    '/api/system-prompts/:id',
    async (request, reply) => {
      const body = request.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.name === 'string') updates.name = body.name;
      if (typeof body.description === 'string') updates.description = body.description;
      if (typeof body.content === 'string') updates.content = body.content;

      const [prompt] = await db.update(systemPrompts)
        .set(updates)
        .where(eq(systemPrompts.id, request.params.id))
        .returning();
      if (!prompt) return reply.status(404).send({ error: 'System prompt not found' });
      return prompt;
    }
  );

  // Delete a project-specific system prompt (can't delete global defaults)
  fastify.delete<{ Params: { id: string } }>(
    '/api/system-prompts/:id',
    async (request, reply) => {
      const [prompt] = await db.select().from(systemPrompts)
        .where(eq(systemPrompts.id, request.params.id));
      if (!prompt) return reply.status(404).send({ error: 'System prompt not found' });
      if (!prompt.projectId && prompt.isDefault) {
        return reply.status(400).send({ error: 'Cannot delete global default prompts' });
      }

      await db.delete(systemPrompts).where(eq(systemPrompts.id, request.params.id));
      return { ok: true };
    }
  );
}
