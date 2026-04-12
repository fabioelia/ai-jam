import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db/connection.js';
import { projectScans } from '../db/schema.js';
import { triggerScan, getKnowledgePath, listKnowledgeFiles } from '../services/scan-service.js';

export async function scanRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Trigger a new repo scan
  fastify.post<{ Params: { projectId: string }; Body: { systemPromptId?: string } }>(
    '/api/projects/:projectId/scans',
    async (request, reply) => {
      try {
        const scan = await triggerScan(request.params.projectId, request.body?.systemPromptId);
        return reply.status(201).send(scan);
      } catch (err) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    }
  );

  // List scans for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/scans',
    async (request) => {
      return db.select().from(projectScans)
        .where(eq(projectScans.projectId, request.params.projectId))
        .orderBy(desc(projectScans.createdAt));
    }
  );

  // Get a single scan
  fastify.get<{ Params: { id: string } }>(
    '/api/scans/:id',
    async (request, reply) => {
      const [scan] = await db.select().from(projectScans)
        .where(eq(projectScans.id, request.params.id));
      if (!scan) return reply.status(404).send({ error: 'Scan not found' });
      return scan;
    }
  );

  // List knowledge files for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/knowledge',
    async (request) => {
      const files = listKnowledgeFiles(request.params.projectId);
      return files.map((filename) => ({
        filename,
        path: join(getKnowledgePath(request.params.projectId), filename),
      }));
    }
  );

  // Get a knowledge file's content
  fastify.get<{ Params: { projectId: string; filename: string } }>(
    '/api/projects/:projectId/knowledge/:filename',
    async (request, reply) => {
      const { projectId, filename } = request.params;

      // Sanitize filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/')) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }

      const filePath = join(getKnowledgePath(projectId), filename);
      try {
        const content = readFileSync(filePath, 'utf-8');
        return { filename, content };
      } catch {
        return reply.status(404).send({ error: 'Knowledge file not found' });
      }
    }
  );
}
