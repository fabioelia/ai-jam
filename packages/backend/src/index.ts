import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { createServer } from 'http';
import { config } from './config.js';
import authPlugin from './auth/auth-plugin.js';
import { authRoutes } from './auth/auth-routes.js';
import { projectRoutes } from './routes/projects.js';
import { featureRoutes } from './routes/features.js';
import { epicRoutes } from './routes/epics.js';
import { ticketRoutes } from './routes/tickets.js';
import { commentRoutes } from './routes/comments.js';
import { boardRoutes } from './routes/board.js';
import { agentSessionRoutes } from './routes/agent-sessions.js';
import { chatSessionRoutes } from './routes/chat-sessions.js';
import { proposalRoutes } from './routes/proposals.js';
import { ticketNoteRoutes } from './routes/ticket-notes.js';
import { transitionGateRoutes } from './routes/transition-gates.js';
import { systemPromptRoutes } from './routes/system-prompts.js';
import { scanRoutes } from './routes/scans.js';
import { notificationRoutes } from './routes/notifications.js';
import { attentionRoutes } from './routes/attention.js';
import { userRoutes } from './routes/users.js';
import { setupSocketServer } from './websocket/socket-server.js';
import { startRuntime } from './agent-runtime/runtime-manager.js';
import { startPtyDaemon } from './agent-runtime/pty-daemon-manager.js';
import { db } from './db/connection.js';
import { chatSessions, agentSessions } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  // Mark leftover running agent sessions as failed — but leave chat sessions alone.
  // Chat session PTYs live in the agent-runtime process which survives backend restarts.
  // Chat session status is updated by the runtime-manager when PTYs actually exit.
  await db.update(agentSessions).set({ status: 'failed', activity: 'idle', outputSummary: 'Session interrupted by backend restart', completedAt: new Date() }).where(eq(agentSessions.status, 'running'));
  await db.update(agentSessions).set({ status: 'failed', activity: 'idle', outputSummary: 'Session never started (pending at backend restart)', completedAt: new Date() }).where(eq(agentSessions.status, 'pending'));

  const fastify = Fastify({
    logger: true,
  });

  // CORS — allow any origin in dev (backend is on 0.0.0.0 for LAN access)
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting (global default — generous; auth routes override with stricter limits)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart file uploads (5 MB limit)
  await fastify.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // Auth
  await fastify.register(authPlugin);

  // Routes
  await fastify.register(authRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(featureRoutes);
  await fastify.register(epicRoutes);
  await fastify.register(ticketRoutes);
  await fastify.register(commentRoutes);
  await fastify.register(boardRoutes);
  await fastify.register(agentSessionRoutes);
  await fastify.register(chatSessionRoutes);
  await fastify.register(proposalRoutes);
  await fastify.register(ticketNoteRoutes);
  await fastify.register(transitionGateRoutes);
  await fastify.register(systemPromptRoutes);
  await fastify.register(scanRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(attentionRoutes);
  await fastify.register(userRoutes);

  // Health check
  fastify.get('/api/health', async () => ({ status: 'ok' }));

  // Start server
  await fastify.ready();

  // Get the underlying http server for Socket.IO
  const httpServer = fastify.server;
  setupSocketServer(httpServer);

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`AI Jam backend running on port ${config.port}`);

  // Connect to agent-runtime (non-blocking — will retry if not available)
  startRuntime().catch((err) => {
    console.warn('Agent runtime not available at startup:', err.message || err);
  });

  // Connect to pty-daemon for interactive sessions (non-blocking)
  startPtyDaemon().catch((err) => {
    console.warn('PTY daemon not available at startup:', err.message || err);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
