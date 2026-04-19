import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (two levels up from packages/backend/)
dotenv.config({ path: resolve(process.cwd(), '..', '..', '.env') });
// Also load local .env if it exists (overrides)
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://aijam:aijam@localhost:5433/aijam',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  agentRuntimeSocket: process.env.AGENT_RUNTIME_SOCKET || '/tmp/ai-jam-runtime.sock',
  ptyDaemonSocket: process.env.PTY_DAEMON_SOCKET || '/tmp/ai-jam-pty-daemon.sock',
  maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '12', 10),
  /** Static service token for agent-runtime orchestrator authentication. */
  serviceToken: process.env.AIJAM_SERVICE_TOKEN || '',
  // AI via OpenRouter
  openrouterApiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  openrouterBaseUrl: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api',
  aiModel: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || process.env.CLAUDE_MODEL || 'qwen/qwen3.6-plus',
  // S3 avatar storage
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || 'ai-jam-avatars',
  s3Endpoint: process.env.S3_ENDPOINT || undefined,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || undefined,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || undefined,
};
