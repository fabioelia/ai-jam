import type { PtyManager } from './pty-manager.js';

/**
 * State machine that reliably sends a prompt to Claude CLI.
 *
 * Adapted from Colony's send-prompt-when-ready.ts (lines 34-100).
 *
 * Claude CLI has a startup sequence:
 * 1. Initial output (loading, trust dialog, etc.)
 * 2. First "waiting" state — might be the trust dialog, press Enter to dismiss
 * 3. Second "waiting" state — the actual prompt, ready for input
 *
 * This state machine handles that sequence, with a force-send timeout
 * as a safety net.
 */

type State = 'init' | 'first_wait' | 'dismissed' | 'ready' | 'sent' | 'timeout';

interface SendPromptOptions {
  sessionId: string;
  prompt: string;
  ptyManager: PtyManager;
  /** Force-send timeout if second 'waiting' never arrives (ms). Default: 5000 */
  forceTimeoutMs?: number;
  /** Total abandon timeout (ms). Default: 15000 */
  abandonTimeoutMs?: number;
  /** Callback when prompt is sent */
  onSent?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export function sendPromptWhenReady(options: SendPromptOptions): () => void {
  const {
    sessionId,
    prompt,
    ptyManager,
    forceTimeoutMs = 5_000,
    abandonTimeoutMs = 15_000,
    onSent,
    onError,
  } = options;

  let state: State = 'init';
  let waitCount = 0;
  let forceTimer: ReturnType<typeof setTimeout> | null = null;
  let abandonTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function cleanup() {
    disposed = true;
    if (forceTimer) {
      clearTimeout(forceTimer);
      forceTimer = null;
    }
    if (abandonTimer) {
      clearTimeout(abandonTimer);
      abandonTimer = null;
    }
    ptyManager.removeListener('activity', onActivity);
  }

  function fire() {
    if (disposed || state === 'sent') return;
    state = 'sent';

    // Write the prompt text first, then submit after a short delay
    // so the TUI has time to process the input before receiving Enter.
    // (Matches Colony's send-prompt-when-ready.ts fire() pattern)
    const written = ptyManager.write(sessionId, prompt);
    if (!written) {
      onError?.(new Error(`Failed to write prompt to session ${sessionId}`));
      cleanup();
      return;
    }

    setTimeout(() => {
      ptyManager.write(sessionId, '\r');
      // Mark the instance as running
      const instance = ptyManager.get(sessionId);
      if (instance) instance.status = 'running';
      onSent?.();
      cleanup();
    }, 150);
  }

  function onActivity({ sessionId: sid, activity }: { sessionId: string; activity: string }) {
    if (disposed || sid !== sessionId) return;

    if (activity === 'waiting') {
      waitCount++;

      if (state === 'init') {
        // First wait — could be trust/directory dialog. Dismiss with Enter.
        state = 'first_wait';
        ptyManager.write(sessionId, '\r');
        state = 'dismissed';

        // If no second 'waiting' arrives, force-send after timeout
        forceTimer = setTimeout(() => {
          if (!disposed && state !== 'sent') {
            fire();
          }
        }, forceTimeoutMs);
      } else if (state === 'dismissed' || (state === 'first_wait' && waitCount >= 2)) {
        // Second wait — CLI is actually ready for input
        if (forceTimer) {
          clearTimeout(forceTimer);
          forceTimer = null;
        }
        state = 'ready';
        fire();
      }
    }
  }

  // Listen for activity events
  ptyManager.on('activity', onActivity);

  // Safety abandon timeout — give up entirely
  abandonTimer = setTimeout(() => {
    if (!disposed && state !== 'sent') {
      console.warn(`[send-prompt] Abandoning prompt delivery to ${sessionId} after ${abandonTimeoutMs}ms (state: ${state})`);
      state = 'timeout';
      fire();
    }
  }, abandonTimeoutMs);

  // Check current state in case the first 'waiting' already fired before
  // we attached the listener (race between spawnSession resolving and
  // the CLI reaching its idle prompt).
  const instance = ptyManager.get(sessionId);
  if (instance && instance.activityDetector.activity === 'waiting' && !disposed && waitCount === 0) {
    onActivity({ sessionId, activity: 'waiting' });
  }

  // Return cleanup function
  return cleanup;
}
