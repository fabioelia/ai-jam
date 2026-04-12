#!/usr/bin/env node
/**
 * AI Jam MCP Server
 *
 * Provides structured tools for Claude CLI agents to interact with the
 * AI Jam backend. Spawned per-session by the agent-runtime alongside
 * each Claude CLI PTY process.
 *
 * Receives context via environment variables:
 *   AIJAM_SESSION_ID   -- the agent/chat session ID
 *   AIJAM_PROJECT_ID   -- project being worked on
 *   AIJAM_FEATURE_ID   -- feature being planned/implemented
 *   AIJAM_TICKET_ID    -- ticket being worked on (execution phase, optional)
 *   AIJAM_AUTH_TOKEN    -- JWT token for the user who initiated the session
 *   AIJAM_USER_ID      -- user ID of the session initiator
 *   AIJAM_API_BASE_URL  -- backend API base URL (default: http://localhost:3002)
 *   AIJAM_WORKING_DIR  -- working directory for file operations
 *   AIJAM_PHASE        -- "planning" or "execution"
 *
 * Transport: stdio (Claude CLI connects via --mcp-config)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { registerPlanningTools } from './tools/planning.js';
import { registerExecutionTools } from './tools/execution.js';
import { registerSharedTools } from './tools/shared.js';

// -- Read environment --

const sessionId = process.env.AIJAM_SESSION_ID;
const projectId = process.env.AIJAM_PROJECT_ID;
const featureId = process.env.AIJAM_FEATURE_ID;
const ticketId = process.env.AIJAM_TICKET_ID;
const authToken = process.env.AIJAM_AUTH_TOKEN;
const userId = process.env.AIJAM_USER_ID;
const apiBaseUrl = process.env.AIJAM_API_BASE_URL || 'http://localhost:3002';
const workingDirectory = process.env.AIJAM_WORKING_DIR || process.cwd();
const phase = process.env.AIJAM_PHASE || 'planning';

// Validate required env vars
const missing: string[] = [];
if (!sessionId) missing.push('AIJAM_SESSION_ID');
if (!projectId) missing.push('AIJAM_PROJECT_ID');
if (!featureId) missing.push('AIJAM_FEATURE_ID');
if (!authToken) missing.push('AIJAM_AUTH_TOKEN');
if (!userId) missing.push('AIJAM_USER_ID');

if (missing.length > 0) {
  process.stderr.write(`[mcp-server] Missing required env vars: ${missing.join(', ')}\n`);
  process.exit(1);
}

// -- Create MCP server --

const server = new McpServer({
  name: 'ai-jam',
  version: '1.0.0',
});

// -- Create API client --

const api = new ApiClient({
  baseUrl: apiBaseUrl,
  authToken: authToken!,
  sessionId: sessionId!,
});

// -- Context objects --

const toolCtx = {
  projectId: projectId!,
  featureId: featureId!,
  sessionId: sessionId!,
  ticketId: ticketId || undefined,
};

// -- Register tools based on phase --

if (phase === 'planning') {
  registerPlanningTools(server, api, toolCtx);
}

if (phase === 'execution') {
  registerExecutionTools(server, api, toolCtx);
}

// Shared tools are available in all phases
registerSharedTools(server, { workingDirectory });

// -- Start server --

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[mcp-server] AI Jam MCP server started (phase=${phase}, session=${sessionId?.slice(0, 8)})\n`);
}

main().catch((err) => {
  process.stderr.write(`[mcp-server] Fatal error: ${err}\n`);
  process.exit(1);
});
