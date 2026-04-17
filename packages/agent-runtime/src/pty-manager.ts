import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, unlinkSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import { ActivityDetector, type Activity } from './activity-detector.js';
import type { SessionType } from './protocol.js';

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
  sessionType: SessionType;
  personaType: string;
  model: string;
  process: pty.IPty;
  activityDetector: ActivityDetector;
  status: 'starting' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  outputBuffer: string[];
}

/**
 * MCP context for connecting agents to the AI Jam MCP server.
 * When provided, a per-session MCP config file is generated and
 * passed to Claude CLI via --mcp-config.
 */
export interface McpContext {
  sessionId: string;
  projectId: string;
  featureId: string;
  ticketId?: string;
  userId: string;
  authToken: string;
  apiBaseUrl?: string;
  phase: 'planning' | 'execution';
}

export interface SpawnOptions {
  sessionId: string;
  sessionType: SessionType;
  personaType: string;
  model: string;
  prompt: string;
  workingDirectory: string;
  contextFiles?: string[];
  addDirs?: string[];
  name?: string;
  interactive?: boolean;
  systemPromptFile?: string;
  /** Extra context appended to the system prompt file (project/feature info). */
  systemContext?: string;
  /** MCP server context -- when provided, agent gets structured tools. */
  mcpContext?: McpContext;
  /** When set, use --session-id to pin Claude CLI's session UUID (for future resume). */
  cliSessionId?: string;
  /** When set, use --resume to resume a prior Claude CLI session by its UUID. */
  resumeSessionId?: string;
}

/**
 * Manages node-pty instances for Claude CLI sessions.
 * Adapted from Colony's pty-daemon.ts.
 */
export class PtyManager extends EventEmitter {
  private instances = new Map<string, PtyInstance>();
  /** Temp MCP config files to clean up when sessions end. */
  private mcpConfigPaths = new Map<string, string>();

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
    console.log(`[pty-manager] Spawning: ${claudePath} ${args.join(' ')}`);

    let shellProc;
    try {
      // Try spawning Claude CLI directly (node-pty@1.2.0-beta.12 should work)
      shellProc = pty.spawn(claudePath, args, {
        name: 'xterm-256color',
        cols: options.interactive ? 120 : 200,
        rows: options.interactive ? 40 : 50,
        cwd: options.workingDirectory,
        env,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : '';
      console.error(`[pty-manager] pty.spawn failed:`, message);
      console.error(`[pty-manager] Error stack:`, stack);
      console.error(`[pty-manager] Command: ${claudePath}`);
      console.error(`[pty-manager] Args: ${args.join(' ')}`);
      console.error(`[pty-manager] Working dir: ${options.workingDirectory}`);
      console.error(`[pty-manager] Cwd exists:`, existsSync(options.workingDirectory));
      throw err;
    }

    const detector = new ActivityDetector();

    const instance: PtyInstance = {
      id: ptyId,
      sessionId: options.sessionId,
      sessionType: options.sessionType,
      personaType: options.personaType,
      model: options.model,
      process: shellProc,
      activityDetector: detector,
      status: 'starting',
      startedAt: new Date(),
      completedAt: null,
      outputBuffer: [],
    };

    this.instances.set(options.sessionId, instance);

    // Wire up output
    shellProc.onData((data: string) => {
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
    shellProc.onExit(({ exitCode }) => {
      detector.stop();
      instance.status = exitCode === 0 ? 'completed' : 'failed';
      instance.completedAt = new Date();
      this.cleanupMcpConfig(options.sessionId);
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
    this.cleanupMcpConfig(sessionId);
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

  /**
   * Clean up a session's temporary MCP config file.
   */
  private cleanupMcpConfig(sessionId: string) {
    const configPath = this.mcpConfigPaths.get(sessionId);
    if (configPath) {
      try {
        if (existsSync(configPath)) unlinkSync(configPath);
      } catch { /* ignore */ }
      this.mcpConfigPaths.delete(sessionId);
    }
  }

  /**
   * Write a per-session MCP config JSON file for Claude CLI.
   * Returns the path to the config file.
   *
   * Claude CLI expects a JSON file like:
   * {
   *   "mcpServers": {
   *     "ai-jam": {
   *       "command": "npx",
   *       "args": ["tsx", "/path/to/mcp/server.ts"],
   *       "env": { ... }
   *     }
   *   }
   * }
   */
  private writeMcpConfig(options: SpawnOptions): string | null {
    if (!options.mcpContext) return null;

    const mcpDir = join(tmpdir(), 'ai-jam-mcp-configs');
    mkdirSync(mcpDir, { recursive: true });

    const configPath = join(mcpDir, `${options.sessionId}.json`);

    // Resolve path to the MCP server entry point relative to this file
    const serverPath = join(__dirname, 'mcp', 'server.ts');

    const config = {
      mcpServers: {
        'ai-jam': {
          command: 'npx',
          args: ['tsx', serverPath],
          env: {
            AIJAM_SESSION_ID: options.mcpContext.sessionId,
            AIJAM_PROJECT_ID: options.mcpContext.projectId,
            AIJAM_FEATURE_ID: options.mcpContext.featureId,
            AIJAM_TICKET_ID: options.mcpContext.ticketId || '',
            AIJAM_AUTH_TOKEN: options.mcpContext.authToken,
            AIJAM_USER_ID: options.mcpContext.userId,
            AIJAM_API_BASE_URL: options.mcpContext.apiBaseUrl || 'http://localhost:3002',
            AIJAM_WORKING_DIR: options.workingDirectory,
            AIJAM_PHASE: options.mcpContext.phase,
          },
        },
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.mcpConfigPaths.set(options.sessionId, configPath);
    return configPath;
  }

  private buildArgs(options: SpawnOptions, ptyId: string): string[] {
    const args: string[] = [
      '--dangerously-skip-permissions',
      '--model', options.model,
      '--output-format', 'text',
    ];

    // MCP config: write config file and add --mcp-config flag
    const mcpConfigPath = this.writeMcpConfig(options);
    if (mcpConfigPath) {
      args.push('--mcp-config', mcpConfigPath);
    }

    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    } else if (options.cliSessionId) {
      args.push('--session-id', options.cliSessionId);
    }

    if (options.name) {
      args.push('--name', options.name);
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
