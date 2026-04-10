import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { ActivityDetector, type Activity } from './activity-detector.js';

/**
 * Resolve a command to its full path using the user's shell environment.
 * Adapted from Colony's resolveCommand() in pty-daemon.ts.
 * node-pty's posix_spawnp may not find commands in user-installed paths
 * like ~/.local/bin — resolving upfront prevents "posix_spawnp failed".
 */
const _resolvedCommands = new Map<string, string>();
function resolveCommand(cmd: string): string {
  if (cmd.startsWith('/')) return cmd;
  const cached = _resolvedCommands.get(cmd);
  if (cached) return cached;
  try {
    const resolved = execSync(`which ${cmd}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (resolved) {
      _resolvedCommands.set(cmd, resolved);
      return resolved;
    }
  } catch { /* fall through */ }
  return cmd;
}

export interface PtyInstance {
  id: string;
  sessionId: string;
  personaType: string;
  model: string;
  process: pty.IPty;
  activityDetector: ActivityDetector;
  status: 'starting' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  outputBuffer: string[];
}

export interface SpawnOptions {
  sessionId: string;
  personaType: string;
  model: string;
  prompt: string;
  workingDirectory: string;
  contextFiles?: string[];
  addDirs?: string[];
  name?: string;
  interactive?: boolean;
  systemPromptFile?: string;
}

/**
 * Manages node-pty instances for Claude CLI sessions.
 * Adapted from Colony's pty-daemon.ts.
 */
export class PtyManager extends EventEmitter {
  private instances = new Map<string, PtyInstance>();

  /**
   * Spawn a new Claude CLI session.
   */
  spawn(options: SpawnOptions): PtyInstance {
    const ptyId = uuid();

    const args = this.buildArgs(options, ptyId);

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color',
    };

    // Only set CI=1 for non-interactive (headless) sessions.
    // Interactive sessions need the full TUI which CI=1 suppresses.
    if (!options.interactive) {
      env.CI = '1';
    }

    const claudePath = resolveCommand('claude');
    const proc = pty.spawn(claudePath, args, {
      name: 'xterm-256color',
      cols: options.interactive ? 120 : 200,
      rows: options.interactive ? 40 : 50,
      cwd: options.workingDirectory,
      env,
    });

    const detector = new ActivityDetector();

    const instance: PtyInstance = {
      id: ptyId,
      sessionId: options.sessionId,
      personaType: options.personaType,
      model: options.model,
      process: proc,
      activityDetector: detector,
      status: 'starting',
      startedAt: new Date(),
      completedAt: null,
      outputBuffer: [],
    };

    this.instances.set(options.sessionId, instance);

    // Wire up output
    proc.onData((data: string) => {
      instance.outputBuffer.push(data);
      if (instance.outputBuffer.length > 5000) {
        instance.outputBuffer = instance.outputBuffer.slice(-2500);
      }
      detector.feedOutput(data);
      this.emit('output', { sessionId: options.sessionId, ptyId, chunk: data });
    });

    // Wire up activity changes
    detector.on('activity', (activity: Activity) => {
      this.emit('activity', { sessionId: options.sessionId, ptyId, activity });
    });

    // Wire up exit
    proc.onExit(({ exitCode }) => {
      detector.stop();
      instance.status = exitCode === 0 ? 'completed' : 'failed';
      instance.completedAt = new Date();
      this.emit('exit', { sessionId: options.sessionId, ptyId, exitCode });
    });

    // Start activity detection
    detector.start();

    return instance;
  }

  /**
   * Send text input to a session's PTY.
   */
  write(sessionId: string, data: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance || instance.status === 'completed' || instance.status === 'failed') {
      return false;
    }
    instance.process.write(data);
    return true;
  }

  /**
   * Kill a session's PTY process.
   */
  kill(sessionId: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance) return false;

    instance.activityDetector.stop();
    instance.process.kill();
    instance.status = 'failed';
    instance.completedAt = new Date();
    return true;
  }

  /**
   * Get the output buffer for a session (for replay on client attach).
   */
  getBuffer(sessionId: string): string {
    const instance = this.instances.get(sessionId);
    if (!instance) return '';
    return instance.outputBuffer.join('');
  }

  /**
   * Get a session's PTY instance.
   */
  get(sessionId: string): PtyInstance | undefined {
    return this.instances.get(sessionId);
  }

  /**
   * List all active sessions.
   */
  listActive(): PtyInstance[] {
    return [...this.instances.values()].filter(
      (i) => i.status === 'starting' || i.status === 'running'
    );
  }

  /**
   * List all sessions.
   */
  listAll(): PtyInstance[] {
    return [...this.instances.values()];
  }

  /**
   * Clean up completed/failed sessions older than given age.
   */
  cleanup(maxAgeMs: number = 3600_000) {
    const now = Date.now();
    for (const [sessionId, instance] of this.instances) {
      if (
        (instance.status === 'completed' || instance.status === 'failed') &&
        instance.completedAt &&
        now - instance.completedAt.getTime() > maxAgeMs
      ) {
        this.instances.delete(sessionId);
      }
    }
  }

  /**
   * Kill all sessions and clean up.
   */
  shutdown() {
    for (const [sessionId] of this.instances) {
      this.kill(sessionId);
    }
    this.instances.clear();
  }

  private buildArgs(options: SpawnOptions, ptyId: string): string[] {
    const args: string[] = [
      '--dangerously-skip-permissions',
      '--model', options.model,
      '--output-format', 'text',
    ];

    if (options.name) {
      args.push('--resume', options.name);
    }

    if (options.workingDirectory) {
      args.push('--add-dir', options.workingDirectory);
    }

    if (options.addDirs) {
      for (const dir of options.addDirs) {
        args.push('--add-dir', dir);
      }
    }

    // Append persona system prompt file (like colony's AGENTS.md pattern)
    if (options.systemPromptFile) {
      args.push('--append-system-prompt-file', options.systemPromptFile);
    }

    // Interactive mode: launch Claude CLI for full TUI experience
    // Don't pass prompt — it will be sent via sendPromptWhenReady after TUI initializes
    if (options.interactive) {
      // Remove --output-format text — TUI renders its own output
      const fmtIdx = args.indexOf('--output-format');
      if (fmtIdx !== -1) args.splice(fmtIdx, 2);
      // No prompt arg — TUI launches clean, prompt sent after ready
    } else if (options.prompt) {
      args.push('--print', options.prompt);
    }

    return args;
  }
}
