import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://aijam:aijam@localhost:5433/aijam',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  agentRuntimeSocket: process.env.AGENT_RUNTIME_SOCKET || '/tmp/ai-jam-runtime.sock',
  maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '12', 10),
};
