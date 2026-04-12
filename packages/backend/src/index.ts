import Fastify from 'fastify';
import cors from '@fastify/cors';
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
import { setupSocketServer } from './websocket/socket-server.js';
import { startRuntime } from './agent-runtime/runtime-manager.js';
import { db } from './db/connection.js';
import { chatSessions, agentSessions } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  // Mark any leftover active sessions as completed — PTY processes don't survive restarts
  await db.update(chatSessions).set({ status: 'completed' }).where(eq(chatSessions.status, 'active'));
  await db.update(agentSessions).set({ status: 'failed', activity: 'idle', completedAt: new Date() }).where(eq(agentSessions.status, 'running'));

  const fastify = Fastify({
    logger: true,
  });

  // CORS — allow any origin in dev (backend is on 0.0.0.0 for LAN access)
  await fastify.register(cors, {
    origin: true,
    credentials: true,
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
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
