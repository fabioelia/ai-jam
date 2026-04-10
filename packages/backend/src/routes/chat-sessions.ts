import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { chatSessions, chatMessages, features, projects } from '../db/schema.js';
import { v4 as uuid } from 'uuid';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import { broadcastToFeature } from '../websocket/socket-server.js';
import { ensureFeatureWorktree } from '../services/repo-workspace.js';

export async function chatSessionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List chat sessions for a feature
  fastify.get<{ Params: { featureId: string } }>(
    '/api/features/:featureId/chat-sessions',
    async (request) => {
      return db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.featureId, request.params.featureId))
        .orderBy(desc(chatSessions.createdAt));
    }
  );

  // Get a chat session with messages
  fastify.get<{ Params: { id: string } }>(
    '/api/chat-sessions/:id',
    async (request, reply) => {
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, request.params.id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatSessionId, request.params.id))
        .orderBy(chatMessages.createdAt);

      return { ...session, messages };
    }
  );

  // Create a new chat session (starts a planning Claude session)
  fastify.post<{ Params: { featureId: string } }>(
    '/api/features/:featureId/chat-sessions',
    async (request, reply) => {
      const { featureId } = request.params;
      const { userId } = request.user;

      // Verify feature exists
      const [feature] = await db
        .select()
        .from(features)
        .where(eq(features.id, featureId));
      if (!feature) return reply.status(404).send({ error: 'Feature not found' });

      const sessionId = uuid();

      const [session] = await db
        .insert(chatSessions)
        .values({
          id: sessionId,
          featureId,
          userId,
          status: 'active',
        })
        .returning();

      // Immediately spawn an interactive Claude CLI session
      const client = getRuntimeClient();
      if (client.isConnected) {
        try {
          // Get the project for repo context
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, feature.projectId));

          // Try to set up a worktree for this feature's repo
          let workingDirectory = process.cwd();
          let repoAvailable = false;
          try {
            const workspace = await ensureFeatureWorktree(feature.projectId, featureId);
            workingDirectory = workspace.localPath;
            repoAvailable = true;
          } catch (err) {
            console.warn('[chat-sessions] Could not set up worktree, using cwd:', (err as Error).message);
          }

          // Build a rich initial prompt with project + repo context
          const contextParts: string[] = [];
          if (project) {
            contextParts.push(`## Project: ${project.name}`);
            if (project.repoUrl) {
              contextParts.push(`- **Repository**: ${project.repoUrl}`);
              contextParts.push(`- **Default branch**: ${project.defaultBranch}`);
            }
            if (repoAvailable) {
              contextParts.push(`- **Working directory**: ${workingDirectory} (repo is cloned and available — explore the code to understand the codebase)`);
            } else {
              contextParts.push(`- **Note**: Repository is not yet cloned locally. Work with the user based on their description.`);
            }
            contextParts.push('');
          }
          contextParts.push(`## Feature: ${feature.title}`);
          if (feature.description) {
            contextParts.push('');
            contextParts.push(feature.description);
          }
          contextParts.push('');
          contextParts.push('Start by exploring the repository to understand the codebase, then help the user plan this feature.');

          const featureContext = contextParts.join('\n');

          const result = await client.spawnSession({
            sessionId,
            personaType: 'planner',
            model: 'opus',
            prompt: featureContext,
            workingDirectory,
            interactive: true,
          });

          // Update session with pty instance id
          await db
            .update(chatSessions)
            .set({ ptyInstanceId: result.ptyInstanceId })
            .where(eq(chatSessions.id, sessionId));
        } catch (err) {
          console.error('Failed to spawn planning session:', err);
        }
      }

      return session;
    }
  );

  // Send a message in a chat session
  fastify.post<{ Params: { id: string }; Body: { content: string } }>(
    '/api/chat-sessions/:id/messages',
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { content } = request.body;

      if (!content?.trim()) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId));
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      if (session.status !== 'active') {
        return reply.status(400).send({ error: 'Session is not active' });
      }

      // Save user message
      const [userMessage] = await db
        .insert(chatMessages)
        .values({
          chatSessionId: sessionId,
          role: 'user',
          content: content.trim(),
        })
        .returning();

      // Broadcast to feature room
      broadcastToFeature(session.featureId, 'chat:message', {
        sessionId,
        role: 'user',
        content: content.trim(),
      });

      // Forward message to the running Claude CLI session
      const client = getRuntimeClient();
      if (client.isConnected && session.ptyInstanceId) {
        try {
          // Write directly to the PTY (user is interacting via the terminal)
          await client.writeToSession(sessionId, content.trim() + '\n');
        } catch (err) {
          console.error('Failed to write to planning session:', err);
        }
      }

      return userMessage;
    }
  );

  // Complete a chat session
  fastify.post<{ Params: { id: string } }>(
    '/api/chat-sessions/:id/complete',
    async (request, reply) => {
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, request.params.id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Kill the runtime session if it exists
      if (session.ptyInstanceId) {
        const client = getRuntimeClient();
        if (client.isConnected) {
          try {
            await client.killSession(request.params.id);
          } catch { /* ignore */ }
        }
      }

      const [updated] = await db
        .update(chatSessions)
        .set({ status: 'completed' })
        .where(eq(chatSessions.id, request.params.id))
        .returning();

      return updated;
    }
  );
}
