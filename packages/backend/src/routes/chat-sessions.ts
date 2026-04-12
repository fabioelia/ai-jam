import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { chatSessions, chatMessages, features, projects } from '../db/schema.js';
import { config } from '../config.js';
import { v4 as uuid } from 'uuid';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import { getPtyDaemonClient } from '../agent-runtime/pty-daemon-manager.js';
import { broadcastToFeature } from '../websocket/socket-server.js';
import { ensureFeatureWorktree } from '../services/repo-workspace.js';
import { listKnowledgeFiles, getKnowledgePath } from '../services/scan-service.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Check if Claude CLI has a stored session for this UUID.
 * Claude stores sessions as `<uuid>.jsonl` files under ~/.claude/projects/<dir>/
 */
function hasCliSession(sessionId: string): boolean {
  const claudeProjectsDir = join(homedir(), '.claude', 'projects');
  try {
    const dirs = readdirSync(claudeProjectsDir);
    for (const dir of dirs) {
      const sessionFile = join(claudeProjectsDir, dir, `${sessionId}.jsonl`);
      if (existsSync(sessionFile)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

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

      // Spawn interactive Claude CLI session via pty-daemon (falls back to agent-runtime)
      const ptyClient = getPtyDaemonClient();
      const rtClient = getRuntimeClient();
      const client = ptyClient.isConnected ? ptyClient : rtClient;
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
            }
            if (project.localPath) {
              contextParts.push(`- **Local directory**: ${project.localPath}`);
            }
            contextParts.push(`- **Default branch**: ${project.defaultBranch}`);
            if (repoAvailable) {
              contextParts.push(`- **Working directory**: ${workingDirectory} (repo is available — explore the code to understand the codebase)`);
            } else {
              contextParts.push(`- **Note**: Repository is not yet cloned locally. Work with the user based on their description.`);
            }
            contextParts.push('');
          }
          // Inject knowledge files from repo scans
          const knowledgeFileNames = listKnowledgeFiles(feature.projectId);
          if (knowledgeFileNames.length > 0) {
            contextParts.push('## Repository Knowledge (from automated scan)');
            contextParts.push('');
            const knowledgePath = getKnowledgePath(feature.projectId);
            for (const filename of knowledgeFileNames) {
              try {
                const content = readFileSync(join(knowledgePath, filename), 'utf-8');
                contextParts.push(`### ${filename}`);
                contextParts.push(content);
                contextParts.push('');
              } catch { /* skip unreadable files */ }
            }
          }

          contextParts.push(`## Feature: ${feature.title}`);
          if (feature.description) {
            contextParts.push('');
            contextParts.push(feature.description);
          }
          contextParts.push('');
          if (knowledgeFileNames.length > 0) {
            contextParts.push('Use the repository knowledge above as context. Help the user plan this feature.');
          } else {
            contextParts.push('Start by exploring the repository to understand the codebase, then help the user plan this feature.');
          }

          const featureContext = contextParts.join('\n');

          // Generate a long-lived auth token for the MCP server.
          // Standard JWT tokens expire in 15min which is too short for agent sessions
          // that can run up to 30 minutes. Use a 2-hour expiry for safety margin.
          const mcpToken = jwt.sign(
            { userId, email: request.user.email },
            config.jwtSecret,
            { expiresIn: '2h' },
          );

          // Resolve model: project override > default
          const [proj] = await db.select({ overrides: projects.personaModelOverrides }).from(projects).where(eq(projects.id, feature.projectId)).limit(1);
          const plannerModel = (proj?.overrides as Record<string, string>)?.planner || 'opus';

          const result = await client.spawnSession({
            sessionId,
            sessionType: 'planning',
            personaType: 'planner',
            model: plannerModel,
            prompt: '',
            workingDirectory,
            interactive: true,
            cliSessionId: sessionId,
            systemContext: featureContext,
            mcpContext: {
              sessionId,
              projectId: feature.projectId,
              featureId,
              userId,
              authToken: mcpToken,
              apiBaseUrl: `http://localhost:${config.port}`,
              phase: 'planning',
            },
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

      // Forward message to the running Claude CLI session (try pty-daemon first)
      const ptyClient = getPtyDaemonClient();
      const rtClient = getRuntimeClient();
      const activeClient = ptyClient.isConnected ? ptyClient : rtClient;
      if (activeClient.isConnected && session.ptyInstanceId) {
        try {
          await activeClient.writeToSession(sessionId, content.trim() + '\n');
        } catch (err) {
          console.error('Failed to write to planning session:', err);
        }
      }

      return userMessage;
    }
  );

  // Resume a completed chat session (re-spawn PTY with --resume)
  fastify.post<{ Params: { id: string } }>(
    '/api/chat-sessions/:id/resume',
    async (request, reply) => {
      const { userId } = request.user;
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, request.params.id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      if (session.status === 'active') {
        // Check if PTY is actually alive (try pty-daemon first)
        const ptyC = getPtyDaemonClient();
        if (ptyC.isConnected) {
          try {
            const info = await ptyC.getSessionStatus(session.id);
            if (info) return session;
          } catch { /* not in pty-daemon */ }
        }
        const rtC = getRuntimeClient();
        if (rtC.isConnected) {
          try {
            const info = await rtC.getSessionStatus(session.id);
            if (info) return session;
          } catch { /* not in runtime */ }
        }
      }

      // Use pty-daemon for interactive sessions, fall back to agent-runtime
      const ptyClient = getPtyDaemonClient();
      const rtClient = getRuntimeClient();
      const client = ptyClient.isConnected ? ptyClient : rtClient;
      if (!client.isConnected) {
        return reply.status(503).send({ error: 'No runtime available for interactive sessions' });
      }

      // Get feature + project context for MCP
      const [feature] = await db.select().from(features).where(eq(features.id, session.featureId));
      if (!feature) return reply.status(404).send({ error: 'Feature not found' });

      const [project] = await db.select().from(projects).where(eq(projects.id, feature.projectId));

      let workingDirectory = process.cwd();
      try {
        const workspace = await ensureFeatureWorktree(feature.projectId, session.featureId);
        workingDirectory = workspace.localPath;
      } catch { /* use cwd */ }

      const mcpToken = jwt.sign(
        { userId, email: request.user.email },
        config.jwtSecret,
        { expiresIn: '2h' },
      );

      const [proj] = await db.select({ overrides: projects.personaModelOverrides }).from(projects).where(eq(projects.id, feature.projectId)).limit(1);
      const plannerModel = (proj?.overrides as Record<string, string>)?.planner || 'opus';

      // Check if Claude CLI has a stored session we can resume
      const canResume = hasCliSession(session.id);
      console.log(`[chat-sessions] Resume session ${session.id}: canResume=${canResume}`);

      // Build system context for fresh-start case (not needed for true resume)
      let systemContext: string | undefined;
      if (!canResume) {
        const contextParts: string[] = [];
        if (project) {
          contextParts.push(`## Project: ${project.name}`);
          if (project.repoUrl) contextParts.push(`- **Repository**: ${project.repoUrl}`);
          if (project.localPath) contextParts.push(`- **Local directory**: ${project.localPath}`);
          contextParts.push(`- **Default branch**: ${project.defaultBranch}`);
          contextParts.push('');
        }
        const knowledgeFileNames = listKnowledgeFiles(feature.projectId);
        if (knowledgeFileNames.length > 0) {
          contextParts.push('## Repository Knowledge (from automated scan)');
          contextParts.push('');
          const knowledgePath = getKnowledgePath(feature.projectId);
          for (const filename of knowledgeFileNames) {
            try {
              const content = readFileSync(join(knowledgePath, filename), 'utf-8');
              contextParts.push(`### ${filename}`);
              contextParts.push(content);
              contextParts.push('');
            } catch { /* skip */ }
          }
        }
        contextParts.push(`## Feature: ${feature.title}`);
        if (feature.description) contextParts.push('', feature.description);
        contextParts.push('', 'This is a resumed planning session. Help the user continue planning this feature.');
        systemContext = contextParts.join('\n');
      }

      try {
        const result = await client.spawnSession({
          sessionId: session.id,
          sessionType: 'planning',
          personaType: 'planner',
          model: plannerModel,
          prompt: '',
          workingDirectory,
          interactive: true,
          ...(canResume
            ? { resumeSessionId: session.id }
            : { cliSessionId: session.id, systemContext }),
          mcpContext: {
            sessionId: session.id,
            projectId: feature.projectId,
            featureId: session.featureId,
            userId,
            authToken: mcpToken,
            apiBaseUrl: `http://localhost:${config.port}`,
            phase: 'planning',
          },
        });

        const [updated] = await db
          .update(chatSessions)
          .set({ status: 'active', ptyInstanceId: result.ptyInstanceId })
          .where(eq(chatSessions.id, session.id))
          .returning();

        return updated;
      } catch (err) {
        console.error('[chat-sessions] Failed to resume session:', err);
        return reply.status(500).send({ error: 'Failed to resume session' });
      }
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

      // Kill the session (try pty-daemon first, then agent-runtime)
      if (session.ptyInstanceId) {
        let killed = false;
        const ptyC = getPtyDaemonClient();
        if (ptyC.isConnected) {
          try { await ptyC.killSession(request.params.id); killed = true; } catch { /* ignore */ }
        }
        if (!killed) {
          const rtC = getRuntimeClient();
          if (rtC.isConnected) {
            try { await rtC.killSession(request.params.id); } catch { /* ignore */ }
          }
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
