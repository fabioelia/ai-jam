import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { buildContextFile, parseSignals, type ContextBundle, type TicketContext, type BoardContext } from './context-builder.js';
import { v4 as uuid } from 'uuid';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { extractMemories, saveMemories } from './memory-extractor.js';

const CONTEXT_DIR = join(process.env.HOME || '/tmp', '.ai-jam', 'contexts');

/** Minimal ticket shape from the board API */
interface BoardTicket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  epicId: string | null;
  featureId: string;
  projectId: string;
  assignedPersona: string | null;
  storyPoints: number | null;
  sortOrder: number;
}

interface BoardColumn {
  status: string;
  tickets: BoardTicket[];
}

interface Epic {
  id: string;
  title: string;
}

interface BoardState {
  columns: BoardColumn[];
  epics: Epic[];
}

/** Map ticket status to the persona that should work on it */
const STATUS_TO_PERSONA: Record<string, string> = {
  backlog: 'implementer',
  in_progress: 'implementer',
  review: 'reviewer',
  qa: 'qa_tester',
  acceptance: 'acceptance_validator',
};

/** Priority ordering for ticket selection */
const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface OrchestratorConfig {
  backendUrl: string;
  authToken: string;
  pollIntervalMs: number;
  projectId: string;
  workingDirectory: string;
}

/**
 * The Orchestrator polls the board for actionable tickets, selects the
 * highest-priority work, assigns the appropriate persona, and spawns
 * a Claude session to execute it.
 */
export class Orchestrator extends EventEmitter {
  private sessionManager: SessionManager;
  private config: OrchestratorConfig;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeTickets = new Set<string>(); // ticket IDs with running sessions

  constructor(sessionManager: SessionManager, config: OrchestratorConfig) {
    super();
    this.sessionManager = sessionManager;
    this.config = config;

    mkdirSync(CONTEXT_DIR, { recursive: true });

    // Listen for session completions to handle handoffs
    this.sessionManager.on('session:completed', (data: { sessionId: string; exitCode: number | null; outputSummary: string | null }) => {
      this.handleSessionCompleted(data);
    });
  }

  /**
   * Start the orchestrator polling loop.
   */
  start() {
    console.log(`[orchestrator] Starting with ${this.config.pollIntervalMs}ms poll interval`);
    this.poll(); // immediate first poll
    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  /**
   * Stop the orchestrator.
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Single poll cycle: fetch board, find actionable ticket, assign persona.
   */
  private async poll() {
    try {
      const board = await this.fetchBoard();
      if (!board) return;

      const ticket = this.selectTicket(board);
      if (!ticket) return;

      await this.assignAndSpawn(ticket, board);
    } catch (err) {
      console.error('[orchestrator] Poll error:', err);
    }
  }

  /**
   * Select the highest priority actionable ticket from the board.
   *
   * Priority order:
   * 1. acceptance column (closest to done)
   * 2. qa column
   * 3. review column
   * 4. in_progress with no active agent (stalled)
   * 5. backlog (ready for work)
   */
  private selectTicket(board: BoardState): BoardTicket | null {
    const columnOrder = ['acceptance', 'qa', 'review', 'in_progress', 'backlog'];

    for (const status of columnOrder) {
      const column = board.columns.find((c) => c.status === status);
      if (!column) continue;

      // Filter to tickets not already being worked on
      const candidates = column.tickets.filter((t) => !this.activeTickets.has(t.id));
      if (candidates.length === 0) continue;

      // Sort by priority weight (highest first)
      candidates.sort(
        (a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
      );

      return candidates[0];
    }

    return null;
  }

  /**
   * Assign the appropriate persona and spawn a session.
   */
  private async assignAndSpawn(ticket: BoardTicket, board: BoardState) {
    const personaType = STATUS_TO_PERSONA[ticket.status] || 'implementer';

    console.log(`[orchestrator] Assigning ${personaType} to ticket "${ticket.title}" (${ticket.status})`);

    // Mark ticket as active
    this.activeTickets.add(ticket.id);

    // Update ticket's assigned persona in backend
    try {
      await this.apiCall(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedPersona: personaType }),
      });
    } catch (err) {
      console.error('[orchestrator] Failed to update ticket persona:', err);
    }

    // Build context
    const epic = board.epics.find((e) => e.id === ticket.epicId);
    const contextBundle = await this.buildContext(ticket, board, epic);

    // Build context file
    const contextPath = buildContextFile(contextBundle, CONTEXT_DIR);

    // Get persona config for model
    const persona = this.sessionManager.getPersonas().find((p) => p.id === personaType);
    const model = persona?.model || 'sonnet';

    const sessionId = uuid();
    const prompt = `Read the context file at ${contextPath} and execute the work described for ticket "${ticket.title}".`;

    try {
      this.sessionManager.spawnSession({
        sessionId,
        personaType,
        model,
        prompt,
        workingDirectory: this.config.workingDirectory,
        contextFiles: [contextPath],
      });

      this.emit('ticket:assigned', {
        ticketId: ticket.id,
        sessionId,
        personaType,
      });
    } catch (err) {
      console.error(`[orchestrator] Failed to spawn ${personaType} for ticket ${ticket.id}:`, err);
      this.activeTickets.delete(ticket.id);
    }
  }

  /**
   * Handle session completion — parse signals and trigger handoffs/transitions.
   */
  private async handleSessionCompleted(data: { sessionId: string; exitCode: number | null; outputSummary: string | null }) {
    const session = this.sessionManager.getSession(data.sessionId);
    if (!session) return;

    // Find which ticket this session was for
    let ticketId: string | null = null;
    for (const id of this.activeTickets) {
      // We'll match by checking the session manager
      ticketId = id; // simplified — in production, map sessionId → ticketId
      break;
    }

    if (!ticketId) return;
    this.activeTickets.delete(ticketId);

    // Extract and save memories from this session's output
    const fullOutput = data.outputSummary || '';
    if (fullOutput.length > 50) {
      try {
        const memories = extractMemories(session.personaType, ticketId, fullOutput);
        if (memories.length > 0) {
          saveMemories(memories);
          console.log(`[orchestrator] Extracted ${memories.length} memories from ${session.personaType} session`);
        }
      } catch (err) {
        console.error('[orchestrator] Memory extraction failed:', err);
      }
    }

    // Parse signals from the full output
    const instance = (this.sessionManager as unknown as { ptyManager: { get: (id: string) => { activityDetector: { getOutput: () => string } } | undefined } }).ptyManager?.get(data.sessionId);
    const output = instance?.activityDetector?.getOutput() || data.outputSummary || '';
    const signals = parseSignals(output);

    // Handle transition request
    if (signals['TRANSITION_REQUEST']) {
      this.emit('transition:requested', {
        ticketId,
        toStatus: signals['TRANSITION_REQUEST'],
        reason: signals['REASON'] || '',
        sessionId: data.sessionId,
        personaType: session.personaType,
      });
    }

    // Handle handoff
    if (signals['NEXT_PERSONA'] && signals['NEXT_PERSONA'] !== 'none') {
      this.emit('handoff:requested', {
        ticketId,
        fromPersona: session.personaType,
        toPersona: signals['NEXT_PERSONA'],
        summary: signals['SUMMARY'] || '',
        sessionId: data.sessionId,
      });
    }

    // Handle blocker
    if (signals['BLOCKER']) {
      this.emit('ticket:blocked', {
        ticketId,
        blocker: signals['BLOCKER'],
        blockedBy: signals['BLOCKED_BY'] || null,
        personaType: session.personaType,
      });
    }

    // Clear assigned persona if no handoff
    if (!signals['NEXT_PERSONA'] || signals['NEXT_PERSONA'] === 'none') {
      try {
        await this.apiCall(`/tickets/${ticketId}`, {
          method: 'PATCH',
          body: JSON.stringify({ assignedPersona: null }),
        });
      } catch { /* ignore */ }
    }
  }

  private async buildContext(
    ticket: BoardTicket,
    board: BoardState,
    epic: Epic | undefined,
  ): Promise<ContextBundle> {
    // Fetch comments for the ticket
    let comments: TicketContext['comments'] = [];
    try {
      const rawComments = await this.apiCall(`/tickets/${ticket.id}/comments`);
      comments = (rawComments as Array<{ userId: string; body: string; createdAt: string }>).map((c) => ({
        author: c.userId.slice(0, 8),
        body: c.body,
        createdAt: c.createdAt,
      }));
    } catch { /* ignore */ }

    const ticketContext: TicketContext = {
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      epicTitle: epic?.title || null,
      featureTitle: '', // could fetch from feature
      comments,
      handoffNotes: [], // will be populated by handoff manager
    };

    const boardContext: BoardContext = {
      columns: board.columns.map((col) => ({
        status: col.status,
        ticketCount: col.tickets.length,
        tickets: col.tickets.map((t) => ({
          id: t.id,
          title: t.title,
          assignedPersona: t.assignedPersona,
        })),
      })),
    };

    const persona = this.sessionManager.getPersonas().find(
      (p) => p.id === (STATUS_TO_PERSONA[ticket.status] || 'implementer')
    );

    const personaType = STATUS_TO_PERSONA[ticket.status] || 'implementer';

    return {
      ticket: ticketContext,
      board: boardContext,
      personaSystemPrompt: persona?.systemPrompt || '',
      personaType,
      repoPath: this.config.workingDirectory,
    };
  }

  private async fetchBoard(): Promise<BoardState | null> {
    try {
      return await this.apiCall(`/projects/${this.config.projectId}/board`) as BoardState;
    } catch (err) {
      console.error('[orchestrator] Failed to fetch board:', err);
      return null;
    }
  }

  private async apiCall(path: string, options?: RequestInit): Promise<unknown> {
    const url = `${this.config.backendUrl}/api${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.authToken}`,
        ...(options?.headers as Record<string, string> || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`API call ${path} failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
