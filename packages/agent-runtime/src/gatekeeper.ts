import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { v4 as uuid } from 'uuid';

/** Map transitions to their gatekeeper personas */
const TRANSITION_GATEKEEPERS: Record<string, string> = {
  'in_progress→review': 'reviewer',
  'review→qa': 'reviewer',
  'qa→acceptance': 'qa_tester',
  'acceptance→done': 'acceptance_validator',
};

export interface GatekeeperRequest {
  ticketId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  sessionId: string;
  personaType: string;
  ticketTitle: string;
  ticketDescription: string | null;
  workingDirectory: string;
}

/**
 * Spawns gatekeeper personas to validate ticket transitions.
 *
 * When a persona requests a transition (e.g., implementer → review),
 * the gatekeeper spawns the appropriate validation persona to verify
 * the work meets the criteria for that column.
 */
export class Gatekeeper extends EventEmitter {
  private sessionManager: SessionManager;
  private backendUrl: string;
  private authToken: string;

  constructor(sessionManager: SessionManager, backendUrl: string, authToken: string) {
    super();
    this.sessionManager = sessionManager;
    this.backendUrl = backendUrl;
    this.authToken = authToken;
  }

  /**
   * Check if a transition requires gatekeeper validation.
   */
  needsGatekeeper(fromStatus: string, toStatus: string): boolean {
    return `${fromStatus}→${toStatus}` in TRANSITION_GATEKEEPERS;
  }

  /**
   * Get the gatekeeper persona type for a transition.
   */
  getGatekeeperPersona(fromStatus: string, toStatus: string): string | null {
    return TRANSITION_GATEKEEPERS[`${fromStatus}→${toStatus}`] || null;
  }

  /**
   * Validate a transition by spawning a gatekeeper persona.
   */
  async validateTransition(request: GatekeeperRequest): Promise<void> {
    const gatekeeperPersona = this.getGatekeeperPersona(request.fromStatus, request.toStatus);
    if (!gatekeeperPersona) {
      // No gatekeeper needed — auto-approve
      await this.approveViaApi(request.ticketId, request.fromStatus, request.toStatus, gatekeeperPersona || request.personaType);
      return;
    }

    // Create a pending gate via backend API
    let gateId: string;
    try {
      const response = await fetch(`${this.backendUrl}/api/transition-gates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          ticketId: request.ticketId,
          fromStatus: request.fromStatus,
          toStatus: request.toStatus,
          gatekeeperPersona,
          agentSessionId: request.sessionId,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[gatekeeper] Failed to create gate: ${err}`);
        return;
      }

      const data = await response.json() as { id: string };
      gateId = data.id;
    } catch (err) {
      console.error('[gatekeeper] Failed to create gate:', err);
      return;
    }

    // Spawn gatekeeper session
    const sessionId = uuid();
    const prompt = this.buildGatekeeperPrompt(request, gateId);

    try {
      const persona = this.sessionManager.getPersonas().find((p) => p.id === gatekeeperPersona);
      const model = persona?.model || 'sonnet';

      this.sessionManager.spawnSession({
        sessionId,
        sessionType: 'execution',
        personaType: gatekeeperPersona,
        model,
        prompt,
        workingDirectory: request.workingDirectory,
      });

      this.emit('gatekeeper:spawned', {
        gateId,
        sessionId,
        ticketId: request.ticketId,
        gatekeeperPersona,
        fromStatus: request.fromStatus,
        toStatus: request.toStatus,
      });
    } catch (err) {
      console.error(`[gatekeeper] Failed to spawn ${gatekeeperPersona}:`, err);
    }
  }

  private buildGatekeeperPrompt(request: GatekeeperRequest, gateId: string): string {
    return `You are validating a transition for ticket "${request.ticketTitle}" from "${request.fromStatus}" to "${request.toStatus}".

## Ticket Description
${request.ticketDescription || 'No description provided.'}

## Transition Reason
${request.reason}

## Your Task
Review the work done on this ticket and determine if it meets the criteria for moving to "${request.toStatus}".

If the work meets the criteria, output:
\`\`\`
GATE_APPROVE: ${gateId}
REASON: <why this transition is approved>
\`\`\`

If the work does NOT meet the criteria, output:
\`\`\`
GATE_REJECT: ${gateId}
FEEDBACK: <specific issues that need to be addressed>
\`\`\``;
  }

  private async approveViaApi(ticketId: string, fromStatus: string, toStatus: string, persona: string): Promise<void> {
    try {
      await fetch(`${this.backendUrl}/api/tickets/${ticketId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ toStatus }),
      });
    } catch (err) {
      console.error('[gatekeeper] Failed to auto-approve transition:', err);
    }
  }
}
