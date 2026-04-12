import { EventEmitter } from 'events';

export type Activity = 'busy' | 'waiting' | 'idle';

/**
 * Detects Claude CLI activity state by monitoring PTY output.
 *
 * Strategy: Poll output buffer at intervals. If new output appeared since
 * last check → busy. If no output and we see a prompt indicator → waiting.
 * Otherwise → idle after timeout.
 *
 * Adapted from Colony's activity detection pattern.
 */
export class ActivityDetector extends EventEmitter {
  private lastOutputTime = 0;
  private lastOutputLength = 0;
  private currentActivity: Activity = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private outputBuffer = '';
  private startupMode = true;

  // How long without output before we consider it "waiting"
  private readonly waitingThresholdMs = 1500;
  // How long without output before we consider it "idle"
  private readonly idleThresholdMs = 30_000;
  // Poll intervals
  private readonly startupIntervalMs = 500;
  private readonly steadyIntervalMs = 2000;
  // Switch from startup to steady after this many ms
  private readonly startupDurationMs = 15_000;

  private startTime = Date.now();

  get activity(): Activity {
    return this.currentActivity;
  }

  start() {
    this.startTime = Date.now();
    this.startupMode = true;
    this.timer = setInterval(() => this.check(), this.startupIntervalMs);

    // Switch to steady polling after startup period
    setTimeout(() => {
      if (this.timer) {
        clearInterval(this.timer);
        this.startupMode = false;
        this.timer = setInterval(() => this.check(), this.steadyIntervalMs);
      }
    }, this.startupDurationMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Feed PTY output data into the detector.
   */
  feedOutput(data: string) {
    this.outputBuffer += data;
    this.lastOutputTime = Date.now();
    this.lastOutputLength = this.outputBuffer.length;
  }

  private check() {
    const now = Date.now();
    const timeSinceOutput = now - this.lastOutputTime;
    const newActivity = this.detectActivity(timeSinceOutput);

    if (newActivity !== this.currentActivity) {
      this.currentActivity = newActivity;
      this.emit('activity', newActivity);
    }
  }

  private detectActivity(timeSinceOutput: number): Activity {
    // If we got output very recently, agent is busy
    if (timeSinceOutput < this.waitingThresholdMs) {
      return 'busy';
    }

    // Check output buffer for waiting indicators
    const recentOutput = this.getRecentOutput();
    if (this.looksLikeWaiting(recentOutput)) {
      return 'waiting';
    }

    // Long time without output = idle
    if (timeSinceOutput > this.idleThresholdMs) {
      return 'idle';
    }

    // Default: if we had output recently but not super recently, still busy
    // (Claude might be thinking between output chunks)
    return 'busy';
  }

  private getRecentOutput(): string {
    // Last 2KB of output
    return this.outputBuffer.slice(-2048);
  }

  /**
   * Strip all ANSI escape sequences (SGR, CSI, OSC, etc.) from text.
   */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B\[\?[0-9;]*[A-Za-z]|\x1B[>=][0-9]*[A-Za-z]?|\r/g, '');
  }

  /**
   * Check if the output looks like Claude is waiting for input.
   * Claude CLI shows specific patterns when waiting.
   */
  private looksLikeWaiting(output: string): boolean {
    const cleaned = this.stripAnsi(output);
    const lastLine = cleaned.split('\n').filter(Boolean).pop() || '';
    const trimmed = lastLine.trim();

    // Claude CLI prompt patterns
    if (trimmed.endsWith('>') || trimmed.endsWith('❯')) return true;
    if (trimmed.includes('You:') || trimmed.includes('Human:')) return true;
    // The "waiting for input" idle state — no recognizable prompt but output stopped
    if (this.lastOutputTime > 0 && Date.now() - this.lastOutputTime > this.waitingThresholdMs) {
      return true;
    }
    return false;
  }

  /**
   * Get the full output buffer (for parsing signals, etc.)
   */
  getOutput(): string {
    return this.outputBuffer;
  }

  /**
   * Clear the output buffer (e.g., after parsing).
   */
  clearOutput() {
    this.outputBuffer = '';
  }
}
