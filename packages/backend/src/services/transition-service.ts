import { db } from '../db/connection.js';
import { transitionGates, tickets, agentSessions, projects } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { broadcastToBoard, broadcastToTicket } from '../websocket/socket-server.js';
import { notifyProjectMembers } from './notification-service.js';
import { createAttentionItem } from './attention-service.js';
import type { TicketStatus } from '@ai-jam/shared';

/** Map of transitions that require a gatekeeper */
const GATED_TRANSITIONS: Record<string, string> = {
  'in_progress→review': 'reviewer',
  'review→qa': 'reviewer',      // reviewer approval IS the gate
  'qa→acceptance': 'qa_tester',
  'acceptance→done': 'acceptance_validator',
};

const DEFAULT_MAX_REJECTION_CYCLES = 3;

async function getMaxRejectionCycles(projectId: string): Promise<number> {
  const [project] = await db
    .select({ maxRejectionCycles: projects.maxRejectionCycles })
    .from(projects)
    .where(eq(projects.id, projectId));

  return project?.maxRejectionCycles ?? DEFAULT_MAX_REJECTION_CYCLES;
}

/**
 * Check if a ticket transition requires a gatekeeper.
 */
export function requiresGatekeeper(fromStatus: string, toStatus: string): string | null {
  return GATED_TRANSITIONS[`${fromStatus}→${toStatus}`] || null;
}

/**
 * Request a gated transition — creates a pending gate record.
 * Returns the gate ID.
 */
export async function requestTransition(
  ticketId: string,
  fromStatus: TicketStatus,
  toStatus: TicketStatus,
  gatekeeperPersona: string,
  agentSessionId?: string,
): Promise<string> {
  // Check rejection count to enforce cap
  const [ticketForCheck] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  const maxCycles = ticketForCheck
    ? await getMaxRejectionCycles(ticketForCheck.projectId)
    : DEFAULT_MAX_REJECTION_CYCLES;

  const priorRejections = await db
    .select()
    .from(transitionGates)
    .where(
      and(
        eq(transitionGates.ticketId, ticketId),
        eq(transitionGates.fromStatus, fromStatus),
        eq(transitionGates.toStatus, toStatus),
        eq(transitionGates.result, 'rejected'),
      )
    );

  if (priorRejections.length >= maxCycles) {
    // Escalate to human — don't create another gate, just leave ticket in current state
    if (ticketForCheck) {
      broadcastToBoard(ticketForCheck.projectId, 'board:ticket:updated', {
        ticketId,
        changes: { assignedPersona: 'HUMAN_ESCALATION' },
      });

      await db
        .update(tickets)
        .set({ assignedPersona: 'HUMAN_ESCALATION' })
        .where(eq(tickets.id, ticketId));

      await notifyProjectMembers({
        projectId: ticketForCheck.projectId,
        type: 'human_escalation',
        title: `${ticketForCheck.title} escalated to human — ${gatekeeperPersona} exceeded retry limit`,
        ticketId,
        featureId: ticketForCheck.featureId ?? undefined,
        metadata: { priority: 'critical' },
      });

      // Create attention item for human escalation
      createAttentionItem({
        projectId: ticketForCheck.projectId,
        featureId: ticketForCheck.featureId ?? undefined,
        ticketId,
        type: 'human_escalation',
        title: `${ticketForCheck.title} — escalated to human after ${maxCycles} rejection cycles`,
        description: `${gatekeeperPersona} exceeded retry limit for ${fromStatus} → ${toStatus}`,
        metadata: {
          gatekeeperPersona,
          transitionFrom: fromStatus,
          transitionTo: toStatus,
          rejectionCount: priorRejections.length,
          maxCycles,
        },
      }).catch((err) => {
        console.error('[transition-service] Failed to create escalation attention item:', err);
      });
    }
    throw new Error(`Max rejection cycles (${maxCycles}) reached for ${fromStatus}→${toStatus}. Escalated to human.`);
  }

  const [gate] = await db
    .insert(transitionGates)
    .values({
      ticketId,
      fromStatus,
      toStatus,
      gatekeeperPersona,
      result: 'pending',
      agentSessionId: agentSessionId || null,
    })
    .returning();

  // Broadcast gate created
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (ticket) {
    broadcastToBoard(ticket.projectId, 'agent:gate:result', {
      ticketId,
      gate,
    });

    // Create attention item for human review of gated transition
    createAttentionItem({
      projectId: ticket.projectId,
      featureId: ticket.featureId ?? undefined,
      ticketId,
      type: 'transition_gate',
      title: `${ticket.title} — ${gatekeeperPersona} gate: ${fromStatus} → ${toStatus}`,
      metadata: {
        gateId: gate.id,
        transitionFrom: fromStatus,
        transitionTo: toStatus,
        gatekeeperPersona,
        agentSessionId: agentSessionId ?? null,
      },
    }).catch((err) => {
      console.error('[transition-service] Failed to create attention item:', err);
    });
  }

  return gate.id;
}

/**
 * Approve a transition gate — moves the ticket.
 */
export async function approveTransition(gateId: string): Promise<void> {
  const [gate] = await db
    .select()
    .from(transitionGates)
    .where(eq(transitionGates.id, gateId));
  if (!gate) throw new Error('Gate not found');
  if (gate.result !== 'pending') throw new Error('Gate already resolved');

  // Update gate
  await db
    .update(transitionGates)
    .set({ result: 'approved', resolvedAt: new Date() })
    .where(eq(transitionGates.id, gateId));

  // Move the ticket
  const [ticket] = await db
    .update(tickets)
    .set({
      status: gate.toStatus,
      assignedPersona: null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, gate.ticketId))
    .returning();

  if (ticket) {
    broadcastToBoard(ticket.projectId, 'board:ticket:moved', {
      ticketId: ticket.id,
      fromStatus: gate.fromStatus,
      toStatus: gate.toStatus,
      sortOrder: ticket.sortOrder,
    });

    broadcastToTicket(ticket.id, 'agent:gate:result', {
      ticketId: ticket.id,
      gate: { ...gate, result: 'approved', resolvedAt: new Date().toISOString() },
    });

    notifyProjectMembers({
      projectId: ticket.projectId,
      type: 'ticket_moved',
      title: `${ticket.title} moved to ${gate.toStatus}`,
      body: `Ticket moved from ${gate.fromStatus} to ${gate.toStatus} by ${gate.gatekeeperPersona}`,
      actionUrl: `/projects/${ticket.projectId}/board?ticket=${ticket.id}`,
      ticketId: ticket.id,
      featureId: ticket.featureId ?? undefined,
      metadata: { fromStatus: gate.fromStatus, toStatus: gate.toStatus, persona: gate.gatekeeperPersona },
    }).catch(() => {});
  }
}

/**
 * Reject a transition gate — ticket stays, provides feedback.
 */
export async function rejectTransition(gateId: string, feedback: string): Promise<void> {
  const [gate] = await db
    .select()
    .from(transitionGates)
    .where(eq(transitionGates.id, gateId));
  if (!gate) throw new Error('Gate not found');
  if (gate.result !== 'pending') throw new Error('Gate already resolved');

  // Update gate
  await db
    .update(transitionGates)
    .set({ result: 'rejected', feedback, resolvedAt: new Date() })
    .where(eq(transitionGates.id, gateId));

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, gate.ticketId));
  if (ticket) {
    broadcastToBoard(ticket.projectId, 'agent:gate:result', {
      ticketId: ticket.id,
      gate: { ...gate, result: 'rejected', feedback, resolvedAt: new Date().toISOString() },
    });

    await notifyProjectMembers({
      projectId: ticket.projectId,
      type: 'gate_rejected',
      title: `${ticket.title} rejected by ${gate.gatekeeperPersona} — ${feedback}`,
      body: feedback,
      ticketId: ticket.id,
      featureId: ticket.featureId ?? undefined,
    });

    // Loop detection: check if ticket has hit the rejection threshold
    const allRejections = await db
      .select()
      .from(transitionGates)
      .where(
        and(
          eq(transitionGates.ticketId, ticket.id),
          eq(transitionGates.result, 'rejected'),
        )
      )
      .orderBy(desc(transitionGates.resolvedAt));

    const maxCycles = await getMaxRejectionCycles(ticket.projectId);

    if (allRejections.length >= maxCycles) {
      const feedbackSummary = allRejections
        .filter((r) => r.feedback)
        .map((r, i) => `${i + 1}. [${r.gatekeeperPersona}] ${r.feedback}`)
        .join('\n');

      const lastRejection = allRejections[0];

      await notifyProjectMembers({
        projectId: ticket.projectId,
        type: 'loop_detected',
        title: `${ticket.title} stuck in review loop — ${allRejections.length} rejections`,
        body: feedbackSummary || 'No rejection feedback recorded.',
        actionUrl: `/projects/${ticket.projectId}/board?ticket=${ticket.id}`,
        ticketId: ticket.id,
        featureId: ticket.featureId ?? undefined,
        metadata: {
          priority: 'critical',
          rejectionCount: allRejections.length,
          lastFeedback: lastRejection?.feedback ?? null,
          persona: lastRejection?.gatekeeperPersona ?? null,
        },
      });
    }
  }
}

/**
 * Get transition gates for a ticket.
 */
export async function getTransitionGates(ticketId: string) {
  return db
    .select()
    .from(transitionGates)
    .where(eq(transitionGates.ticketId, ticketId));
}

// ---------------------------------------------------------------------------
// Project-level gate settings (transition_gates JSONB on projects table)
// ---------------------------------------------------------------------------

/**
 * Build the gate key from two statuses: e.g. "review" + "qa" → "review_to_qa"
 */
function buildGateKey(fromStatus: string, toStatus: string): string {
  return `${fromStatus}_to_${toStatus}`;
}

/**
 * Check if a project has a gate enabled for a specific transition.
 * Returns true if gated, false otherwise.
 */
export async function isTransitionGated(
  projectId: string,
  fromStatus: string,
  toStatus: string,
): Promise<boolean> {
  const [project] = await db
    .select({ transitionGates: projects.transitionGates })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) return false;

  const gateSettings = (project.transitionGates as Record<string, boolean>) ?? {};
  return gateSettings[buildGateKey(fromStatus, toStatus)] === true;
}

export interface GateAwareMoveResult {
  /** Whether the ticket was actually moved */
  transitioned: boolean;
  /** Whether a gate blocked the transition */
  gated: boolean;
  /** Gate record ID if gated */
  gateId?: string;
  /** The ticket's current status after the operation */
  ticketStatus: string;
  /** The requested target status */
  requestedStatus: string;
}

/**
 * Gate-aware ticket move. Checks project gate settings before executing.
 *
 * - If no gate active → moves ticket directly, returns { transitioned: true }
 * - If gate active → creates gate record + attention item, returns { transitioned: false, gated: true }
 */
export async function requestGateAwareMove(params: {
  ticketId: string;
  toStatus: TicketStatus;
  requestedBy: string;
  agentSessionId?: string;
}): Promise<GateAwareMoveResult> {
  const { ticketId, toStatus, requestedBy, agentSessionId } = params;

  // Fetch ticket
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticket) throw new Error('Ticket not found');

  const fromStatus = ticket.status as TicketStatus;

  // Same status — no-op
  if (fromStatus === toStatus) {
    return { transitioned: false, gated: false, ticketStatus: fromStatus, requestedStatus: toStatus };
  }

  // Check project gate settings
  const gated = await isTransitionGated(ticket.projectId, fromStatus, toStatus);

  if (!gated) {
    // No gate — move directly
    const [updated] = await db
      .update(tickets)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

    broadcastToBoard(ticket.projectId, 'board:ticket:moved', {
      ticketId: updated.id,
      fromStatus,
      toStatus,
      sortOrder: updated.sortOrder,
    });

    notifyProjectMembers({
      projectId: ticket.projectId,
      type: 'ticket_moved',
      title: `${ticket.title} moved to ${toStatus}`,
      body: `Ticket moved from ${fromStatus} to ${toStatus} by ${requestedBy}`,
      actionUrl: `/projects/${ticket.projectId}/board?ticket=${ticket.id}`,
      featureId: ticket.featureId ?? undefined,
      ticketId: ticket.id,
      metadata: { fromStatus, toStatus, persona: requestedBy },
    }).catch(() => {});

    return { transitioned: true, gated: false, ticketStatus: toStatus, requestedStatus: toStatus };
  }

  // Gate is active — create gate record + attention item (via existing requestTransition)
  const gateId = await requestTransition(
    ticketId,
    fromStatus,
    toStatus,
    requestedBy,
    agentSessionId,
  );

  return {
    transitioned: false,
    gated: true,
    gateId,
    ticketStatus: fromStatus,
    requestedStatus: toStatus,
  };
}
