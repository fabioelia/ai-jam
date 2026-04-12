/**
 * Ticket Execution Orchestrator
 *
 * Runs as a periodic loop inside the agent-runtime process.
 * Polls the backend API for board state and spawns agent sessions
 * for actionable tickets based on a rule-based priority system:
 *
 *   1. acceptance  → acceptance_validator
 *   2. qa          → qa_tester
 *   3. review      → reviewer
 *   4. backlog     → implementer (moves to in_progress first)
 *   5. in_progress → implementer (if stuck with no active session)
 *
 * Agents are spawned with MCP context so they get structured tools
 * (signal_complete, request_transition, get_ticket_details, etc.).
 */

import { v4 as uuid } from 'uuid';
import type { SessionManager } from './session-manager.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  /** Backend base URL (e.g. http://localhost:3002) */
  apiBaseUrl: string;
  /** Long-lived service token accepted by the backend */
  serviceToken: string;
  /** Service user ID embedded in the token */
  serviceUserId: string;
  /** Explicit project IDs to orchestrate (if empty, auto-discovers all projects) */
  projectIds?: string[];
  /** Polling interval in ms (default 60_000) */
  pollIntervalMs?: number;
  /** Max tickets to pick per cycle (default 3) */
  maxPicksPerCycle?: number;
}

interface BoardTicket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  featureId: string;
  projectId: string;
  assignedPersona: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BoardColumn {
  status: string;
  tickets: BoardTicket[];
}

interface BoardResponse {
  columns: BoardColumn[];
}

interface AgentSessionRecord {
  id: string;
  ticketId: string | null;
  personaType: string;
  status: string;
  activity: string;
  createdAt: string;
  completedAt: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  localPath: string | null;
  repoUrl: string | null;
  personaModelOverrides: Record<string, string> | null;
}

interface FeatureRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface TicketNote {
  id: string;
  authorType: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: string;
}

/** What the orchestrator decides to do with a ticket. */
interface TicketAction {
  ticket: BoardTicket;
  personaType: string;
  /** Whether we need to move the ticket before spawning. */
  moveToStatus?: string;
}

// ---------------------------------------------------------------------------
// Lightweight HTTP client (same pattern as MCP api-client)
// ---------------------------------------------------------------------------

class OrchestratorApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'X-AI-Jam-Source': 'orchestrator',
    };
  }

  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GET ${path} failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class TicketOrchestrator {
  private config: OrchestratorConfig & { pollIntervalMs: number; maxPicksPerCycle: number };
  private sessionManager: SessionManager;
  private api: OrchestratorApiClient;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(sessionManager: SessionManager, config: OrchestratorConfig) {
    this.sessionManager = sessionManager;
    this.config = {
      ...config,
      projectIds: config.projectIds ?? [],
      pollIntervalMs: config.pollIntervalMs ?? 60_000,
      maxPicksPerCycle: config.maxPicksPerCycle ?? 3,
    };
    this.api = new OrchestratorApiClient(this.config.apiBaseUrl, this.config.serviceToken);
  }

  /**
   * Start the orchestrator loop.
   */
  start() {
    if (this.timer) return;
    const mode = this.config.projectIds?.length
      ? `${this.config.projectIds.length} project(s)`
      : 'auto-discover all projects';
    console.log(
      `[orchestrator] Starting — polling every ${this.config.pollIntervalMs / 1000}s, ${mode}`,
    );

    // Run first tick after a short delay to let the runtime settle
    setTimeout(() => this.tick(), 5_000);
    this.timer = setInterval(() => this.tick(), this.config.pollIntervalMs);
  }

  /**
   * Stop the orchestrator loop.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[orchestrator] Stopped');
  }

  // -------------------------------------------------------------------------
  // Core loop
  // -------------------------------------------------------------------------

  /**
   * Single orchestrator tick: for each project, fetch board, pick tickets, spawn agents.
   */
  private async tick() {
    if (this.running) {
      console.log('[orchestrator] Previous tick still running, skipping');
      return;
    }
    this.running = true;
    this.projectCache.clear();

    try {
      // Auto-discover projects if none configured
      let projectIds = this.config.projectIds ?? [];
      if (projectIds.length === 0) {
        try {
          const projects = await this.api.get<{ id: string }[]>('/api/projects');
          projectIds = projects.map((p) => p.id);
        } catch (err) {
          console.error('[orchestrator] Failed to discover projects:', err instanceof Error ? err.message : err);
          return;
        }
      }

      for (const projectId of projectIds) {
        await this.processProject(projectId);
      }
    } catch (err) {
      console.error('[orchestrator] Tick error:', err instanceof Error ? err.message : err);
    } finally {
      this.running = false;
    }
  }

  private async processProject(projectId: string) {
    // Check capacity: how many more agents can we spawn?
    const activeSessions = this.sessionManager.listSessions().filter(
      (s) => s.status === 'starting' || s.status === 'running',
    );
    const maxConcurrent = this.sessionManager.getMaxConcurrent();
    const availableSlots = maxConcurrent - activeSessions.length;
    if (availableSlots <= 0) {
      console.log('[orchestrator] No available slots, skipping');
      return;
    }

    // Fetch board state
    let board: BoardResponse;
    try {
      board = await this.api.get<BoardResponse>(`/api/projects/${projectId}/board`);
    } catch (err) {
      console.error(
        `[orchestrator] Failed to fetch board for ${projectId}:`,
        err instanceof Error ? err.message : err,
      );
      return;
    }

    // Fetch active agent sessions to avoid duplicating work
    let activeAgentSessions: AgentSessionRecord[];
    try {
      const running = await this.api.get<AgentSessionRecord[]>(`/api/agent-sessions?status=running`);
      const pending = await this.api.get<AgentSessionRecord[]>(`/api/agent-sessions?status=pending`);
      activeAgentSessions = [...running, ...pending];
    } catch (err) {
      console.error(
        `[orchestrator] Failed to fetch agent sessions:`,
        err instanceof Error ? err.message : err,
      );
      return;
    }

    // Build set of ticket IDs that already have active sessions
    const ticketsWithActiveSessions = new Set(
      activeAgentSessions
        .filter((s) => s.ticketId)
        .map((s) => s.ticketId!),
    );

    // Pick actionable tickets in priority order
    const actions = this.pickActions(board, ticketsWithActiveSessions);

    // Debug: log board state and pick results
    const columnSummary = board.columns.map(c => `${c.status}(${c.tickets.length})`).join(', ');
    console.log(
      `[orchestrator] Project ${projectId.slice(0, 8)}: board=[${columnSummary}], ` +
      `activeAgentSessions=${activeAgentSessions.length}, ` +
      `capacity=${availableSlots}/${maxConcurrent}, ` +
      `actions=${actions.length}`,
    );

    // Limit picks per cycle and by available slots
    const maxPicks = Math.min(this.config.maxPicksPerCycle, availableSlots);
    const picked = actions.slice(0, maxPicks);

    if (picked.length > 0) {
      console.log(
        `[orchestrator] Picked ${picked.length} ticket(s) for project ${projectId.slice(0, 8)}`,
      );
    }

    for (const action of picked) {
      try {
        await this.executeAction(projectId, action);
      } catch (err) {
        console.error(
          `[orchestrator] Failed to execute action for ticket ${action.ticket.id.slice(0, 8)} ` +
          `(${action.personaType}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ticket selection (rule-based)
  // -------------------------------------------------------------------------

  /**
   * Pick actionable tickets from the board in priority order.
   */
  private pickActions(
    board: BoardResponse,
    ticketsWithActiveSessions: Set<string>,
  ): TicketAction[] {
    const actions: TicketAction[] = [];
    const columnMap = new Map(board.columns.map((c) => [c.status, c.tickets]));

    // Priority 1: acceptance → acceptance_validator
    for (const ticket of columnMap.get('acceptance') || []) {
      if (ticketsWithActiveSessions.has(ticket.id)) continue;
      actions.push({ ticket, personaType: 'acceptance_validator' });
    }

    // Priority 2: qa → qa_tester
    for (const ticket of columnMap.get('qa') || []) {
      if (ticketsWithActiveSessions.has(ticket.id)) continue;
      actions.push({ ticket, personaType: 'qa_tester' });
    }

    // Priority 3: review → reviewer
    for (const ticket of columnMap.get('review') || []) {
      if (ticketsWithActiveSessions.has(ticket.id)) continue;
      actions.push({ ticket, personaType: 'reviewer' });
    }

    // Priority 4: backlog → implementer (oldest first)
    const backlogTickets = (columnMap.get('backlog') || []).slice().sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const ticket of backlogTickets) {
      if (ticketsWithActiveSessions.has(ticket.id)) continue;
      actions.push({ ticket, personaType: 'implementer', moveToStatus: 'in_progress' });
    }

    // Priority 5: in_progress with no active session → respawn implementer
    for (const ticket of columnMap.get('in_progress') || []) {
      if (ticketsWithActiveSessions.has(ticket.id)) continue;
      actions.push({ ticket, personaType: 'implementer' });
    }

    return actions;
  }

  // -------------------------------------------------------------------------
  // Action execution
  // -------------------------------------------------------------------------

  /**
   * Execute a single ticket action: move ticket if needed, create DB session, spawn agent.
   */
  private async executeAction(projectId: string, action: TicketAction) {
    const { ticket, personaType, moveToStatus } = action;
    const sessionId = uuid();

    console.log(
      `[orchestrator] Spawning ${personaType} for ticket ` +
      `"${ticket.title.slice(0, 50)}" (${ticket.id.slice(0, 8)}) ` +
      `[${ticket.status}${moveToStatus ? ` -> ${moveToStatus}` : ''}]`,
    );

    // Move ticket if needed (backlog → in_progress)
    if (moveToStatus) {
      try {
        await this.api.post(`/api/tickets/${ticket.id}/move`, { toStatus: moveToStatus });
      } catch (err) {
        console.warn(
          `[orchestrator] Failed to move ticket ${ticket.id.slice(0, 8)} to ${moveToStatus}:`,
          err instanceof Error ? err.message : err,
        );
        // Continue — the agent can try to move it via MCP tools
      }
    }

    // Resolve working directory
    const workingDirectory = await this.resolveWorkingDirectory(projectId, ticket.featureId);

    // Resolve model (project overrides > persona default)
    const model = await this.resolveModel(projectId, personaType);

    // Build prompt with enriched context
    const prompt = await this.buildPrompt(ticket, personaType, projectId);

    // Create DB record via backend API so the session is tracked.
    // Pass skipSpawn: true because we spawn the session ourselves below.
    // Use the returned session ID so runtime and DB are in sync.
    let dbSessionId = sessionId;
    try {
      const dbRecord = await this.api.post<AgentSessionRecord>('/api/agent-sessions', {
        ticketId: ticket.id,
        personaType,
        prompt,
        workingDirectory,
        skipSpawn: true,
      });
      dbSessionId = dbRecord.id;
    } catch (err) {
      console.warn(
        `[orchestrator] POST /api/agent-sessions failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Spawn via session manager directly (we're in the agent-runtime process)
    // Use dbSessionId so runtime events update the correct DB record
    try {
      this.sessionManager.spawnSession({
        sessionId: dbSessionId,
        sessionType: 'execution',
        personaType,
        model,
        prompt,
        workingDirectory,
        mcpContext: {
          sessionId: dbSessionId,
          projectId,
          featureId: ticket.featureId,
          ticketId: ticket.id,
          userId: this.config.serviceUserId,
          authToken: this.config.serviceToken,
          apiBaseUrl: this.config.apiBaseUrl,
          phase: 'execution',
        },
      });
    } catch (err) {
      console.error(
        `[orchestrator] Failed to spawn ${personaType} for ticket ${ticket.id}:`,
        err instanceof Error ? err.message : err,
      );
      // session:completed already emitted by session-manager — DB will be updated
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Cache project records to avoid re-fetching within a tick. */
  private projectCache = new Map<string, ProjectRecord>();

  private async getProject(projectId: string): Promise<ProjectRecord | null> {
    const cached = this.projectCache.get(projectId);
    if (cached) return cached;
    try {
      const project = await this.api.get<ProjectRecord>(`/api/projects/${projectId}`);
      this.projectCache.set(projectId, project);
      return project;
    } catch {
      return null;
    }
  }

  /**
   * Resolve the working directory for a ticket's feature workspace.
   */
  private async resolveWorkingDirectory(
    projectId: string,
    _featureId: string,
  ): Promise<string> {
    const project = await this.getProject(projectId);
    if (project?.localPath) return project.localPath;
    return process.cwd();
  }

  /**
   * Resolve the model to use for a persona, checking project-level overrides.
   */
  private async resolveModel(projectId: string, personaType: string): Promise<string> {
    const project = await this.getProject(projectId);
    const overrides = project?.personaModelOverrides;
    if (overrides && overrides[personaType]) {
      return overrides[personaType];
    }
    // Fall back to persona config default
    const persona = this.sessionManager.getPersonas().find(p => p.id === personaType);
    return persona?.model || 'sonnet';
  }

  /**
   * Fetch enriched context for a ticket: notes, feature info, sibling tickets, project summary.
   */
  private async fetchTicketContext(
    ticket: BoardTicket,
    projectId: string,
    board: BoardResponse | null,
  ): Promise<{
    notes: TicketNote[];
    feature: FeatureRecord | null;
    siblingTickets: BoardTicket[];
    projectSummary: string;
  }> {
    // Fetch ticket notes (handoff chain, prior agent feedback)
    let notes: TicketNote[] = [];
    try {
      notes = await this.api.get<TicketNote[]>(`/api/tickets/${ticket.id}/notes`);
    } catch { /* non-critical */ }

    // Fetch feature details
    let feature: FeatureRecord | null = null;
    try {
      feature = await this.api.get<FeatureRecord>(`/api/features/${ticket.featureId}`);
    } catch { /* non-critical */ }

    // Collect sibling tickets in same feature from the board
    const siblingTickets: BoardTicket[] = [];
    if (board) {
      for (const col of board.columns) {
        for (const t of col.tickets) {
          if (t.featureId === ticket.featureId && t.id !== ticket.id) {
            siblingTickets.push(t);
          }
        }
      }
    }

    // Build brief project-wide summary from board
    let projectSummary = '';
    if (board) {
      const parts: string[] = [];
      for (const col of board.columns) {
        if (col.tickets.length > 0) {
          parts.push(`${col.status}: ${col.tickets.length}`);
        }
      }
      projectSummary = parts.join(', ');
    }

    return { notes, feature, siblingTickets, projectSummary };
  }

  /**
   * Build the initial prompt for a spawned agent with enriched context.
   */
  private async buildPrompt(
    ticket: BoardTicket,
    personaType: string,
    projectId: string,
  ): Promise<string> {
    // Fetch the board for this project (may already be cached from processProject)
    let board: BoardResponse | null = null;
    try {
      board = await this.api.get<BoardResponse>(`/api/projects/${projectId}/board`);
    } catch { /* non-critical */ }

    const ctx = await this.fetchTicketContext(ticket, projectId, board);
    const lines: string[] = [];

    // --- Assignment ---
    lines.push(`# Your Assignment`);
    lines.push(``);
    lines.push(`You are working on ticket **${ticket.title}** (ID: \`${ticket.id}\`).`);
    lines.push(``);

    if (ticket.description) {
      lines.push(`## Ticket Description`);
      lines.push(``);
      lines.push(ticket.description);
      lines.push(``);
    }

    lines.push(`## Ticket Details`);
    lines.push(``);
    lines.push(`- **Status**: ${ticket.status}`);
    lines.push(`- **Priority**: ${ticket.priority}`);
    if (ctx.feature) {
      lines.push(`- **Feature**: ${ctx.feature.title} (${ctx.feature.status})`);
    }
    lines.push(``);

    // --- Feature context: sibling tickets ---
    if (ctx.siblingTickets.length > 0) {
      lines.push(`## Other Tickets in This Feature`);
      lines.push(``);
      for (const t of ctx.siblingTickets) {
        lines.push(`- [${t.status}] **${t.title}** (${t.priority})`);
      }
      lines.push(``);
    }

    // --- Handoff chain / prior agent notes ---
    if (ctx.notes.length > 0) {
      lines.push(`## Prior Work & Handoff Notes`);
      lines.push(``);
      // Show last 10 notes to avoid prompt bloat
      const recent = ctx.notes.slice(-10);
      for (const note of recent) {
        const author = note.authorType === 'agent' ? `Agent (${note.authorId})` : 'Human';
        const handoff = note.handoffFrom ? ` [handoff: ${note.handoffFrom} → ${note.handoffTo}]` : '';
        lines.push(`**${author}**${handoff} — ${note.createdAt}`);
        lines.push(note.content);
        lines.push(``);
      }
    }

    // --- Brief project-wide snapshot ---
    if (ctx.projectSummary) {
      lines.push(`## Project Board Snapshot`);
      lines.push(``);
      lines.push(`Current ticket distribution: ${ctx.projectSummary}`);
      lines.push(``);
    }

    // --- Persona-specific instructions ---
    switch (personaType) {
      case 'implementer':
        lines.push(`## Instructions`);
        lines.push(``);
        lines.push(`1. Read the prior work notes above carefully — don't redo completed work.`);
        lines.push(`2. Use the \`get_ticket_details\` MCP tool if you need additional context.`);
        lines.push(`3. Implement the changes described in the ticket.`);
        lines.push(`4. Run tests to verify your changes work correctly.`);
        lines.push(`5. When complete, use \`signal_complete\` with a summary and request transition to \`review\`.`);
        break;

      case 'reviewer':
        lines.push(`## Instructions`);
        lines.push(``);
        lines.push(`1. Review the prior work notes to understand what was implemented and any known issues.`);
        lines.push(`2. Review the code changes made for this ticket.`);
        lines.push(`3. Check for code quality, correctness, and adherence to the ticket requirements.`);
        lines.push(`4. If changes look good, use \`signal_complete\` and request transition to \`qa\`.`);
        lines.push(`5. If changes need work, use \`signal_complete\` and request transition back to \`in_progress\` with specific feedback.`);
        break;

      case 'qa_tester':
        lines.push(`## Instructions`);
        lines.push(``);
        lines.push(`1. Review the prior notes to understand what was implemented and what the reviewer found.`);
        lines.push(`2. Write and run tests to verify the implementation.`);
        lines.push(`3. Check edge cases and error handling.`);
        lines.push(`4. If tests pass, use \`signal_complete\` and request transition to \`acceptance\`.`);
        lines.push(`5. If tests fail, use \`signal_complete\` and request transition back to \`in_progress\` with details.`);
        break;

      case 'acceptance_validator':
        lines.push(`## Instructions`);
        lines.push(``);
        lines.push(`1. Review the full handoff chain above to understand the ticket's journey.`);
        lines.push(`2. Validate that the implementation meets all acceptance criteria from the ticket description.`);
        lines.push(`3. Verify tests are passing and the feature works as expected.`);
        lines.push(`4. If accepted, use \`signal_complete\` and request transition to \`done\`.`);
        lines.push(`5. If not accepted, use \`signal_complete\` and request transition back to \`in_progress\` with feedback.`);
        break;
    }

    lines.push(``);
    lines.push(`## Important`);
    lines.push(``);
    lines.push(`- Use MCP tools to interact with the system (get details, add notes, signal completion).`);
    lines.push(`- Always signal completion when done, even if you encounter issues.`);
    lines.push(`- Provide clear, actionable feedback if requesting a transition back to an earlier stage.`);
    lines.push(`- Write a progress note via \`add_ticket_note\` before signaling completion, summarizing what you did and any issues found.`);

    return lines.join('\n');
  }
}
