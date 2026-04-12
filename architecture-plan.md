# Architecture Plan: MCP Server for Agent-to-Backend Communication

## Current State

### How agents communicate today
1. **Planning agents** (planner persona) emit structured text like `PROPOSE_TICKETS: [{...}]` in their PTY output. The backend accumulates output in `planningOutputBuffers`, then `planning-service.ts` regex-parses it via `parseStructuredActions()` to extract `PROPOSE_TICKETS`, `PROPOSE_EPIC`, and `UPDATE_TICKET` actions. This runs on busy-to-waiting activity transitions.

2. **Execution agents** (implementer, reviewer, etc.) emit text signals like `WORK_COMPLETE: true`, `SUMMARY: ...`, `TRANSITION_REQUEST: ...`, `BLOCKER: ...`. These are parsed by `parseSignals()` in `context-builder.ts` on session exit.

3. **Agents have bypassed this** by using `curl` to hit REST endpoints directly with fabricated credentials -- which is why persona files now contain `CRITICAL RESTRICTIONS` warnings against HTTP calls.

### Components involved
- `packages/agent-runtime/src/pty-manager.ts` -- spawns Claude CLI via node-pty, builds CLI args
- `packages/agent-runtime/src/session-manager.ts` -- session lifecycle, wires output events
- `packages/agent-runtime/src/context-builder.ts` -- builds context files for agents, defines text signal parsing
- `packages/backend/src/services/planning-service.ts` -- regex parser for structured actions
- `packages/backend/src/agent-runtime/runtime-manager.ts` -- accumulates planning output, triggers parsing on activity transitions
- Persona `.md` files in `packages/agent-runtime/personas/` -- instruct agents on text signal format

### What Works
- The REST API is clean and complete -- tickets, proposals, comments, epics, transition gates all have working endpoints with auth, validation, and websocket broadcasting
- The NDJSON protocol between backend and agent-runtime is solid
- The persona system (frontmatter + markdown) is good and easily extendable
- The session spawn flow works: backend creates DB record, sends spawn request to runtime, runtime creates PTY

### What Doesn't
- **Text signal parsing is fragile.** Regex on PTY output is unreliable -- ANSI codes, line wrapping, partial output all break it. The planner's output accumulation + busy/waiting state machine in runtime-manager.ts is ~100 lines of workaround for a fundamentally broken communication channel.
- **Agents lack structured tools.** They can only read code and emit text. No way to query board state, read ticket details, or interact with the system programmatically.
- **No origin tracking.** Cannot distinguish whether a ticket/comment/proposal was created by a human or an agent. No audit trail.
- **Agents bypass restrictions.** The `CRITICAL RESTRICTIONS` warnings in personas exist because agents figured out they could curl the API. This is a band-aid -- the real fix is giving them a proper tool channel.

## Target State

### Architecture
An MCP server (stdio transport) runs as a sidecar for each Claude CLI session. Claude CLI natively supports MCP via `--mcp-config`, so the agent gets tools without any PTY parsing.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Claude CLI   │────>│ MCP Server   │────>│ Backend REST │
│ (PTY)        │<────│ (stdio)      │     │ API :3002    │
│              │     │              │     │              │
│ uses tools:  │     │ Translates   │     │ Auth, DB,    │
│ propose_epic │     │ tool calls   │     │ Validation,  │
│ get_board    │     │ to REST API  │     │ Broadcasting │
│ signal_done  │     │ calls with   │     └──────────────┘
│ etc.         │     │ auth token   │
└─────────────┘     └──────────────┘
```

**Key decisions:**
- MCP server lives in `packages/agent-runtime/src/mcp/` -- it's spawned by the runtime alongside each PTY
- Uses `@modelcontextprotocol/sdk` with stdio transport
- Receives context (sessionId, projectId, featureId, userId, authToken) via environment variables
- Calls backend REST API at localhost:3002 with the user's JWT token
- Passes `X-AI-Jam-Source: mcp` header on all requests for origin tracking
- Backend adds `source` column to relevant tables (tickets, comments, proposals, ticket_notes)

### Components

| Component | Responsibility |
|-----------|---------------|
| `mcp/server.ts` | MCP server entry point -- registers tools, handles stdio transport |
| `mcp/tools/planning.ts` | Planning phase tools: propose_epic, propose_tickets, get_board_state, get_feature_context |
| `mcp/tools/execution.ts` | Execution phase tools: signal_complete, request_transition, report_blocker, add_ticket_comment, get_ticket_details |
| `mcp/tools/shared.ts` | Shared tools: record_learning |
| `mcp/api-client.ts` | HTTP client wrapper that injects auth token and source header |
| Updated `pty-manager.ts` | Writes MCP config JSON and passes `--mcp-config` to Claude CLI |
| Updated persona files | Replace text signal instructions with MCP tool documentation |
| DB migration | Add `source` varchar column to tickets, comments, ticket_proposals, ticket_notes |

### Data Model Changes
Add `source` column (varchar(20), default 'human') to:
- `tickets` -- who created it
- `comments` -- who posted it  
- `ticket_proposals` -- who proposed it
- `ticket_notes` -- already has `authorType` which covers this

Schema additions in Drizzle:
```typescript
source: varchar('source', { length: 20 }).default('human').notNull(),
```

### API Surface Changes
Backend routes accept `X-AI-Jam-Source` header. When present and value is `mcp`, the `source` field on created records is set to `mcp` instead of `human`. No new endpoints needed -- the MCP server calls existing REST APIs.

## Migration Plan

### Phase 1: MCP Server Core -- Build the server and API client

**Files:**
- Create `packages/agent-runtime/src/mcp/server.ts`
- Create `packages/agent-runtime/src/mcp/api-client.ts`
- Create `packages/agent-runtime/src/mcp/tools/planning.ts`
- Create `packages/agent-runtime/src/mcp/tools/execution.ts`
- Create `packages/agent-runtime/src/mcp/tools/shared.ts`
- Modify `packages/agent-runtime/package.json` (add `@modelcontextprotocol/sdk` dependency)

**Steps:**
1. Add `@modelcontextprotocol/sdk` to agent-runtime dependencies
2. Build the API client with auth token injection and source header
3. Implement all tool definitions with proper Zod schemas
4. Wire up the MCP server with stdio transport
5. Add an entry point script that reads env vars and starts the server

**Validation:** Run the MCP server standalone with test env vars, verify it starts and responds to tool list requests.

### Phase 2: PTY Integration -- Spawn MCP server with Claude CLI

**Files:**
- Modify `packages/agent-runtime/src/pty-manager.ts` (add MCP config generation)
- Modify `packages/agent-runtime/src/session-manager.ts` (pass MCP context to spawn)
- Modify `packages/agent-runtime/src/protocol.ts` (add MCP context fields to SpawnSessionRequest)
- Modify `packages/backend/src/routes/chat-sessions.ts` (pass auth token and context to spawn)
- Modify `packages/backend/src/routes/agent-sessions.ts` (pass auth token and context to spawn)
- Modify `packages/backend/src/agent-runtime/runtime-client.ts` (add MCP context to spawn payload)
- Modify `packages/backend/src/agent-runtime/runtime-manager.ts` (pass MCP context through)

**Steps:**
1. Add `mcpContext` optional field to SpawnSessionRequest protocol
2. In pty-manager.ts, write a temp MCP config JSON file and add `--mcp-config` to buildArgs
3. Pass userId, authToken, projectId, featureId, sessionId from backend through to runtime
4. Clean up temp MCP config files on session exit

**Validation:** Spawn a planning session with MCP config, verify Claude CLI receives and connects to the MCP server.

### Phase 3: Source Tracking -- DB migration and backend route updates

**Files:**
- Modify `packages/backend/src/db/schema.ts` (add source columns)
- Create DB migration SQL
- Modify `packages/backend/src/routes/tickets.ts` (read X-AI-Jam-Source header)
- Modify `packages/backend/src/routes/comments.ts` (read X-AI-Jam-Source header)
- Modify `packages/backend/src/routes/proposals.ts` (read X-AI-Jam-Source header)

**Steps:**
1. Add `source` column to schema definitions
2. Generate and apply migration
3. Update route handlers to read the source header and set the column

**Validation:** Create a ticket via API with the header, verify source column is `mcp`.

### Phase 4: Persona Updates -- Replace text signals with MCP tools

**Files:**
- Modify `packages/agent-runtime/personas/planner.md`
- Modify `packages/agent-runtime/personas/implementer.md`
- Modify `packages/agent-runtime/personas/reviewer.md`
- Modify all other execution persona files

**Steps:**
1. Remove text signal format instructions from all personas
2. Document available MCP tools per persona phase
3. Remove `CRITICAL RESTRICTIONS` about curl (no longer needed -- agents have proper tools)
4. Keep codebase exploration instructions (still valid)

**Validation:** Start a planning session, verify the agent uses MCP tools instead of text signals.

## Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| MCP server in agent-runtime package | It's spawned alongside PTY processes by the runtime. Putting it in backend would require cross-package process spawning. | Standalone package, backend sub-process |
| Stdio transport | Claude CLI natively supports `--mcp-config` with stdio. No network setup needed. | HTTP/SSE transport (requires port management per session) |
| Call REST API, not DB directly | Reuses all validation, auth, and websocket broadcasting logic. Single source of truth. | Direct DB access (duplicates logic, bypasses broadcasts) |
| `X-AI-Jam-Source` header | Non-invasive -- backend routes read it optionally. Existing API consumers unaffected. | Separate MCP-specific endpoints (duplication), query param (ugly) |
| Temp MCP config file per session | Claude CLI requires a JSON file path for `--mcp-config`. Cleaned up on exit. | Global config (can't pass per-session env vars), stdin config (not supported) |
| `source` column not enum | Using varchar(20) to avoid migration headaches when adding new sources. Values: 'human', 'mcp', 'api'. | Postgres enum (rigid), separate table (over-engineered) |

## Open Questions
- None -- all requirements are clear from the codebase and the user's specification.
