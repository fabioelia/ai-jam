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
import { setupSocketServer } from './websocket/socket-server.js';
import { startRuntime } from './agent-runtime/runtime-manager.js';

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS
  await fastify.register(cors, {
    origin: config.frontendUrl,
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
