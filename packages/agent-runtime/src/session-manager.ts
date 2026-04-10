import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PtyManager, type SpawnOptions } from './pty-manager.js';
import { sendPromptWhenReady } from './send-prompt-when-ready.js';
import { PersonaLoader, type PersonaConfig } from './persona-loader.js';
import { parseSignals } from './context-builder.js';
import type { SessionInfo } from './protocol.js';

export interface SessionManagerOptions {
  personasDir: string;
  maxConcurrent: number;
}

/**
 * Manages Claude CLI session lifecycle: create, monitor, terminate.
 * Coordinates between PTY manager, persona loader, and prompt delivery.
 */
export class SessionManager extends EventEmitter {
  private ptyManager: PtyManager;
  private personaLoader: PersonaLoader;
  private maxConcurrent: number;
  private promptCleanups = new Map<string, () => void>();

  constructor(options: SessionManagerOptions) {
    super();
    this.ptyManager = new PtyManager();
    this.personaLoader = new PersonaLoader(options.personasDir);
    this.maxConcurrent = options.maxConcurrent;

    this.wireEvents();
  }

  /**
   * Initialize: load personas from disk.
   */
  init(): PersonaConfig[] {
    return this.personaLoader.loadAll();
  }

  /**
   * Spawn a new Claude CLI session with a persona.
   */
  spawnSession(options: SpawnOptions): SessionInfo {
    const active = this.ptyManager.listActive();
    if (active.length >= this.maxConcurrent) {
      throw new Error(`Max concurrent sessions reached (${this.maxConcurrent})`);
    }

    const persona = this.personaLoader.get(options.personaType);
    const model = options.model || persona?.model || 'sonnet';

    let spawnOpts: SpawnOptions;

    if (options.interactive) {
      // Interactive mode: launch Claude TUI clean.
      // Persona system prompt goes via --append-system-prompt-file (like Colony's AGENTS.md).
      // User's initial prompt is sent via sendPromptWhenReady after TUI initializes.
      let systemPromptFile: string | undefined;
      if (persona) {
        const promptDir = join(tmpdir(), 'ai-jam-prompts');
        mkdirSync(promptDir, { recursive: true });
        systemPromptFile = join(promptDir, `${options.sessionId}.md`);
        writeFileSync(systemPromptFile, persona.systemPrompt);
      }

      spawnOpts = {
        ...options,
        model,
        prompt: '', // Don't pass prompt as CLI arg — sent after TUI ready
        systemPromptFile,
      };
    } else {
      // Non-interactive mode: prepend persona system prompt to the prompt
      let fullPrompt = options.prompt;
      if (persona) {
        fullPrompt = `${persona.systemPrompt}\n\n---\n\n${options.prompt}`;
      }
      spawnOpts = { ...options, model, prompt: fullPrompt };
    }

    const instance = this.ptyManager.spawn(spawnOpts);

    this.emit('session:started', {
      sessionId: options.sessionId,
      personaType: options.personaType,
      ptyInstanceId: instance.id,
    });

    // For interactive sessions, send the initial prompt after TUI is ready
    if (options.interactive && options.prompt) {
      const cleanup = sendPromptWhenReady({
        sessionId: options.sessionId,
        prompt: options.prompt,
        ptyManager: this.ptyManager,
        onSent: () => {
          this.promptCleanups.delete(options.sessionId);
          // Clean up temp system prompt file
          if (spawnOpts.systemPromptFile) {
            try { unlinkSync(spawnOpts.systemPromptFile); } catch { /* ignore */ }
          }
        },
        onError: (error) => {
          this.emit('session:error', { sessionId: options.sessionId, error: error.message });
          this.promptCleanups.delete(options.sessionId);
        },
      });
      this.promptCleanups.set(options.sessionId, cleanup);
    }

    return {
      sessionId: options.sessionId,
      personaType: options.personaType,
      model,
      ptyInstanceId: instance.id,
      activity: 'idle',
      status: 'starting',
      startedAt: instance.startedAt.toISOString(),
      completedAt: null,
    };
  }

  /**
   * Send a follow-up prompt to an existing session.
   * Uses send-prompt-when-ready to reliably deliver.
   */
  sendPrompt(sessionId: string, prompt: string): boolean {
    const instance = this.ptyManager.get(sessionId);
    if (!instance) return false;

    // If session is in interactive mode and waiting, send directly
    if (instance.activityDetector.activity === 'waiting') {
      return this.ptyManager.write(sessionId, prompt + '\n');
    }

    // Otherwise use the state machine
    const cleanup = sendPromptWhenReady({
      sessionId,
      prompt,
      ptyManager: this.ptyManager,
      onSent: () => {
        this.promptCleanups.delete(sessionId);
      },
      onError: (error) => {
        this.emit('session:error', { sessionId, error: error.message });
        this.promptCleanups.delete(sessionId);
      },
    });

    // Store cleanup in case we need to cancel
    this.promptCleanups.set(sessionId, cleanup);
    return true;
  }

  /**
   * Write raw data to a session's PTY (for interactive terminal use).
   */
  writeToSession(sessionId: string, data: string): boolean {
    return this.ptyManager.write(sessionId, data);
  }

  /**
   * Resize a session's PTY terminal.
   */
  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const instance = this.ptyManager.get(sessionId);
    if (!instance || instance.status === 'completed' || instance.status === 'failed') {
      return false;
    }
    instance.process.resize(cols, rows);
    return true;
  }

  /**
   * Kill a session.
   */
  killSession(sessionId: string): boolean {
    // Clean up any pending prompt delivery
    const cleanup = this.promptCleanups.get(sessionId);
    if (cleanup) {
      cleanup();
      this.promptCleanups.delete(sessionId);
    }

    return this.ptyManager.kill(sessionId);
  }

  /**
   * Get the output buffer for a session (for replay on attach).
   */
  getSessionBuffer(sessionId: string): string {
    return this.ptyManager.getBuffer(sessionId);
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): SessionInfo | null {
    const instance = this.ptyManager.get(sessionId);
    if (!instance) return null;

    return {
      sessionId: instance.sessionId,
      personaType: instance.personaType,
      model: instance.model,
      ptyInstanceId: instance.id,
      activity: instance.activityDetector.activity,
      status: instance.status,
      startedAt: instance.startedAt.toISOString(),
      completedAt: instance.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * List all sessions.
   */
  listSessions(): SessionInfo[] {
    return this.ptyManager.listAll().map((instance) => ({
      sessionId: instance.sessionId,
      personaType: instance.personaType,
      model: instance.model,
      ptyInstanceId: instance.id,
      activity: instance.activityDetector.activity,
      status: instance.status,
      startedAt: instance.startedAt.toISOString(),
      completedAt: instance.completedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Get all loaded personas.
   */
  getPersonas(): PersonaConfig[] {
    return this.personaLoader.getAll();
  }

  /**
   * Shut down all sessions.
   */
  shutdown() {
    for (const cleanup of this.promptCleanups.values()) {
      cleanup();
    }
    this.promptCleanups.clear();
    this.ptyManager.shutdown();
  }

  private wireEvents() {
    // Forward PTY events with signal parsing
    this.ptyManager.on('output', (data: { sessionId: string; ptyId: string; chunk: string }) => {
      this.emit('session:output', { sessionId: data.sessionId, chunk: data.chunk });
    });

    this.ptyManager.on('activity', (data: { sessionId: string; ptyId: string; activity: string }) => {
      this.emit('session:activity', { sessionId: data.sessionId, activity: data.activity });
    });

    this.ptyManager.on('exit', (data: { sessionId: string; ptyId: string; exitCode: number | null }) => {
      // Parse signals from output before emitting completion
      const instance = this.ptyManager.get(data.sessionId);
      let outputSummary: string | null = null;

      if (instance) {
        const output = instance.activityDetector.getOutput();
        const signals = parseSignals(output);
        outputSummary = signals['SUMMARY'] || null;
      }

      this.emit('session:completed', {
        sessionId: data.sessionId,
        exitCode: data.exitCode,
        outputSummary,
      });
    });
  }
}
