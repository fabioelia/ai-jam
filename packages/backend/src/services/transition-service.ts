import { db } from '../db/connection.js';
import { transitionGates, tickets, agentSessions, projects } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { broadcastToBoard, broadcastToTicket } from '../websocket/socket-server.js';
import { notifyProjectMembers } from './notification-service.js';
import type { TicketStatus } from '@ai-jam/shared';

/** Map of transitions that require a gatekeeper */
const GATED_TRANSITIONS: Record<string, string> = {
  'in_progress→review': 'reviewer',
  'review→qa': 'reviewer',      // reviewer approval IS the gate
  'qa→acceptance': 'qa_tester',
  'acceptance→done': 'acceptance_validator',
};

const MAX_REJECTION_CYCLES = 3;

/**
 * Read the configurable rejection threshold from project settings.
 * Falls back to MAX_REJECTION_CYCLES constant when column doesn't exist yet.
 */
async function getMaxRejectionCycles(projectId: string): Promise<number> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  // Once the configurable threshold column lands, read it here:
  // return (project as any)?.maxRejectionCycles ?? MAX_REJECTION_CYCLES;
  return MAX_REJECTION_CYCLES;
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

  if (priorRejections.length >= MAX_REJECTION_CYCLES) {
    // Escalate to human — don't create another gate, just leave ticket in current state
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    if (ticket) {
      broadcastToBoard(ticket.projectId, 'board:ticket:updated', {
        ticketId,
        changes: { assignedPersona: 'HUMAN_ESCALATION' },
      });

      await db
        .update(tickets)
        .set({ assignedPersona: 'HUMAN_ESCALATION' })
        .where(eq(tickets.id, ticketId));

      await notifyProjectMembers({
        projectId: ticket.projectId,
        type: 'human_escalation',
        title: `${ticket.title} escalated to human — ${gatekeeperPersona} exceeded retry limit`,
        ticketId,
        featureId: ticket.featureId ?? undefined,
        metadata: { priority: 'critical' },
      });
    }
    throw new Error(`Max rejection cycles (${MAX_REJECTION_CYCLES}) reached for ${fromStatus}→${toStatus}. Escalated to human.`);
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
