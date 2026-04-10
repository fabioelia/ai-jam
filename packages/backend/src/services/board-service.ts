import { eq, and, gt, lt, gte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, transitionGates } from '../db/schema.js';
import type { TicketStatus } from '@ai-jam/shared';

/**
 * Valid ticket status transitions.
 * Maps from-status to allowed to-statuses.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  backlog: ['in_progress'],
  in_progress: ['review', 'backlog'],
  review: ['qa', 'in_progress'],
  qa: ['acceptance', 'review'],
  acceptance: ['done', 'qa'],
  done: ['acceptance'], // allow reverting from done
};

/**
 * Transitions that require a gatekeeper review.
 */
const GATED_TRANSITIONS: Record<string, string> = {
  'in_progress→review': 'reviewer',
  'review→qa': 'reviewer',
  'qa→acceptance': 'qa_tester',
  'acceptance→done': 'acceptance_validator',
};

/**
 * Validate whether a status transition is allowed.
 */
export function isTransitionAllowed(fromStatus: string, toStatus: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Check if a transition requires a gatekeeper.
 */
export function getGatekeeper(fromStatus: string, toStatus: string): string | null {
  return GATED_TRANSITIONS[`${fromStatus}→${toStatus}`] || null;
}

/**
 * Move a ticket to a new status, validating the transition.
 * Returns the updated ticket or throws if invalid.
 */
export async function moveTicket(
  ticketId: string,
  toStatus: TicketStatus,
  sortOrder?: number,
): Promise<{ ticket: typeof tickets.$inferSelect; fromStatus: string }> {
  const [current] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!current) throw new Error('Ticket not found');

  if (!isTransitionAllowed(current.status, toStatus)) {
    throw new Error(`Invalid transition: ${current.status} → ${toStatus}`);
  }

  // Check if there's a pending gate blocking this transition
  const gatekeeper = getGatekeeper(current.status, toStatus);
  if (gatekeeper) {
    const [pendingGate] = await db.select()
      .from(transitionGates)
      .where(
        and(
          eq(transitionGates.ticketId, ticketId),
          eq(transitionGates.fromStatus, current.status as TicketStatus),
          eq(transitionGates.toStatus, toStatus),
          eq(transitionGates.result, 'pending'),
        )
      )
      .limit(1);

    // If there's a pending gate, the transition must wait
    if (pendingGate) {
      throw new Error(`Transition blocked by pending ${gatekeeper} gate`);
    }
  }

  const updates: Record<string, unknown> = {
    status: toStatus,
    updatedAt: new Date(),
  };

  if (sortOrder !== undefined) {
    updates.sortOrder = sortOrder;
  } else {
    // Place at end of target column
    const [maxSort] = await db.select({ max: sql<number>`COALESCE(MAX(${tickets.sortOrder}), -1)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.projectId, current.projectId),
          eq(tickets.status, toStatus),
        )
      );
    updates.sortOrder = (maxSort?.max ?? -1) + 1;
  }

  const [updated] = await db.update(tickets)
    .set(updates)
    .where(eq(tickets.id, ticketId))
    .returning();

  return { ticket: updated, fromStatus: current.status };
}

/**
 * Reorder a ticket within its current column.
 * Shifts other tickets' sort orders to make room.
 */
export async function reorderTicket(
  ticketId: string,
  newSortOrder: number,
): Promise<typeof tickets.$inferSelect> {
  const [current] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!current) throw new Error('Ticket not found');

  const oldOrder = current.sortOrder;

  if (newSortOrder === oldOrder) return current;

  // Shift other tickets in the same column
  if (newSortOrder > oldOrder) {
    // Moving down: decrement tickets between old and new positions
    await db.update(tickets)
      .set({ sortOrder: sql`${tickets.sortOrder} - 1` })
      .where(
        and(
          eq(tickets.projectId, current.projectId),
          eq(tickets.status, current.status),
          gt(tickets.sortOrder, oldOrder),
          gte(sql`1`, sql`CASE WHEN ${tickets.sortOrder} <= ${newSortOrder} THEN 1 ELSE 0 END`),
        )
      );
  } else {
    // Moving up: increment tickets between new and old positions
    await db.update(tickets)
      .set({ sortOrder: sql`${tickets.sortOrder} + 1` })
      .where(
        and(
          eq(tickets.projectId, current.projectId),
          eq(tickets.status, current.status),
          lt(tickets.sortOrder, oldOrder),
          gte(sql`1`, sql`CASE WHEN ${tickets.sortOrder} >= ${newSortOrder} THEN 1 ELSE 0 END`),
        )
      );
  }

  const [updated] = await db.update(tickets)
    .set({ sortOrder: newSortOrder, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
    .returning();

  return updated;
}
