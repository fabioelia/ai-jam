import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, or, inArray } from 'drizzle-orm';
import { broadcastToBoard } from '../websocket/socket-server.js';

/**
 * Validates that adding dependencies to a ticket won't create a circular dependency.
 * A circular dependency exists if ticket A depends on B, B depends on C, and C depends on A.
 *
 * @param ticketId - The ID of the ticket being modified
 * @param newDependencies - The array of dependency ticket IDs to add
 * @throws Error if a circular dependency is detected
 */
export async function validateNoCircularDependencies(ticketId: string, newDependencies: string[]): Promise<void> {
  if (newDependencies.length === 0) return;

  // Build adjacency list for dependency graph
  // Key: ticket ID, Value: array of ticket IDs it depends on
  const adjacency = new Map<string, string[]>();

  // Get current dependencies for the target ticket
  const [currentTicket] = await db
    .select({ dependencies: tickets.dependencies })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!currentTicket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  // Start with existing dependencies
  adjacency.set(ticketId, currentTicket.dependencies || []);

  // Fetch all dependencies to build the graph
  const allTicketIds = [...new Set([...(currentTicket.dependencies || []), ...newDependencies])];

  for (const depId of allTicketIds) {
    const [depTicket] = await db
      .select({ dependencies: tickets.dependencies })
      .from(tickets)
      .where(eq(tickets.id, depId))
      .limit(1);

    if (depTicket) {
      adjacency.set(depId, depTicket.dependencies || []);
    }
  }

  // Add the new dependencies to the target ticket temporarily for validation
  const testDependencies = [...(currentTicket.dependencies || []), ...newDependencies];
  adjacency.set(ticketId, testDependencies);

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const deps = adjacency.get(node) || [];
    for (const dep of deps) {
      if (hasCycle(dep)) return true;
    }

    recursionStack.delete(node);
    return false;
  }

  // Start DFS from the target ticket
  if (hasCycle(ticketId)) {
    throw new Error('Circular dependency detected. Cannot add these dependencies.');
  }
}

/**
 * Computes the list of tickets that are blocked by the given ticket.
 * A ticket B is blocked by ticket A if B's dependencies include A.
 *
 * @param ticketId - The ID of the ticket to find blockers for
 * @returns Array of ticket IDs that are blocked by this ticket
 */
export async function getBlockedTickets(ticketId: string): Promise<string[]> {
  const blocked = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(or(
      eq(tickets.dependencies, [ticketId]),
      // For array contains, we need to use raw SQL or more complex query
    ));

  // Using a raw query to check if ticketId is in the dependencies array
  const result = await db.execute<{ id: string }>(
    `SELECT id FROM tickets WHERE $1 = ANY(dependencies)`,
    [ticketId]
  );

  return result.rows.map(r => r.id);
}

/**
 * Validates that all dependencies exist and belong to the same project.
 *
 * @param projectId - The project ID
 * @param dependencyIds - Array of dependency ticket IDs to validate
 * @throws Error if any dependency is invalid or belongs to a different project
 */
export async function validateDependencies(projectId: string, dependencyIds: string[]): Promise<void> {
  if (dependencyIds.length === 0) return;

  const deps = await db
    .select({ id: tickets.id, projectId: tickets.projectId })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        // Use raw SQL for IN clause with array
      )
    );

  // Using raw query for IN clause
  const result = await db.execute<{ id: string }>(
    `SELECT id FROM tickets WHERE project_id = $1 AND id = ANY($2)`,
    [projectId, dependencyIds]
  );

  const foundIds = new Set(result.rows.map(r => r.id));
  const missingIds = dependencyIds.filter(id => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(`Invalid dependencies: ${missingIds.join(', ')}. Tickets must exist and belong to the same project.`);
  }
}

/**
 * Cascade status updates when a blocking ticket's status changes.
 * When a ticket moves to 'done', all dependent tickets are unblocked.
 * When a ticket moves away from 'done', all dependent tickets may be blocked again.
 *
 * @param ticketId - The ID of the ticket whose status changed
 * @param projectId - The project ID (for broadcasting)
 * @param newStatus - The new status of the ticket
 * @param previousStatus - The previous status of the ticket (optional)
 */
export async function cascadeStatusUpdate(
  ticketId: string,
  projectId: string,
  newStatus: string,
  previousStatus?: string
): Promise<void> {
  const blockedTickets = await getBlockedTickets(ticketId);

  if (blockedTickets.length === 0) return;

  // For each blocked ticket, check its dependency status
  for (const blockedId of blockedTickets) {
    const [blockedTicket] = await db
      .select({ id: tickets.id, dependencies: tickets.dependencies, status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, blockedId))
      .limit(1);

    if (!blockedTicket) continue;

    const blockers = blockedTicket.dependencies || [];
    if (blockers.length === 0) continue;

    // Get all blocker statuses
    const blockersData = await db
      .select({ id: tickets.id, status: tickets.status })
      .from(tickets)
      .where(inArray(tickets.id, blockers));

    const blockersMap = new Map(blockersData.map(b => [b.id, b.status]));

    const allBlockersDone = blockers.every(blockerId => blockersMap.get(blockerId) === 'done');

    if (allBlockersDone) {
      // All blockers are done - ticket is ready
      console.log(`Ticket ${blockedId} is now unblocked (all dependencies completed)`);
      broadcastToBoard(projectId, 'dependency:unblocked', {
        ticketId: blockedId,
        blockersCompleted: blockers.filter(id => blockersMap.get(id) === 'done'),
      });
    } else if (!allBlockersDone && previousStatus === 'done') {
      // This blocker moved from done to something else - ticket is blocked again
      const incompleteBlockers = blockers.filter(id => blockersMap.get(id) !== 'done');
      console.log(`Ticket ${blockedId} is now blocked by incomplete dependencies: ${incompleteBlockers.join(', ')}`);
      broadcastToBoard(projectId, 'dependency:blocked', {
        ticketId: blockedId,
        incompleteBlockers,
      });
    } else {
      // Ticket remains blocked (some blockers are not done)
      const incompleteBlockers = blockers.filter(id => blockersMap.get(id) !== 'done');
      broadcastToBoard(projectId, 'dependency:blocked', {
        ticketId: blockedId,
        incompleteBlockers,
      });
    }
  }
}

/**
 * Get the full dependency chain for a ticket.
 * This includes:
 * - upstream: tickets that this ticket depends on (blocking tickets)
 * - downstream: tickets that depend on this ticket (blocked tickets)
 * And recursively for both directions.
 *
 * @param ticketId - The ID of the ticket to get the chain for
 * @param maxDepth - Maximum recursion depth (default 5 to prevent infinite loops)
 * @returns Object with upstream and downstream chains
 */
export async function getDependencyChain(
  ticketId: string,
  maxDepth: number = 5
): Promise<{
  upstream: Array<{ ticket: typeof tickets.$inferSelect; depth: number }>;
  downstream: Array<{ ticket: typeof tickets.$inferSelect; depth: number }>;
}> {
  const visited = new Set<string>();
  const upstream: Array<{ ticket: typeof tickets.$inferSelect; depth: number }> = [];
  const downstream: Array<{ ticket: typeof tickets.$inferSelect; depth: number }> = [];

  async function traverseUpstream(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, currentId))
      .limit(1);

    if (!ticket || !ticket.dependencies || ticket.dependencies.length === 0) return;

    for (const depId of ticket.dependencies) {
      if (visited.has(depId)) continue;

      const [depTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, depId))
        .limit(1);

      if (depTicket) {
        upstream.push({ ticket: depTicket, depth: depth + 1 });
        await traverseUpstream(depId, depth + 1);
      }
    }
  }

  async function traverseDownstream(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const blockedTickets = await getBlockedTickets(currentId);

    for (const blockedId of blockedTickets) {
      if (visited.has(blockedId)) continue;

      const [blockedTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, blockedId))
        .limit(1);

      if (blockedTicket) {
        downstream.push({ ticket: blockedTicket, depth: depth + 1 });
        await traverseDownstream(blockedId, depth + 1);
      }
    }
  }

  // Run traversals in parallel
  await Promise.all([
    traverseUpstream(ticketId, 0),
    traverseDownstream(ticketId, 0),
  ]);

  return { upstream, downstream };
}

/**
 * Checks if a ticket is blocked by any of its dependencies.
 * A ticket is blocked if any of its dependencies are not in 'done' status.
 *
 * @param ticketId - The ID of the ticket to check
 * @returns true if the ticket is blocked, false otherwise
 */
export async function isTicketBlocked(ticketId: string): Promise<boolean> {
  const [ticket] = await db
    .select({ dependencies: tickets.dependencies })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket || !ticket.dependencies || ticket.dependencies.length === 0) {
    return false;
  }

  // Check if any dependency is not done
  const result = await db.execute<{ status: string }>(
    `SELECT status FROM tickets WHERE id = ANY($1) AND status != 'done'`,
    [ticket.dependencies]
  );

  return result.rows.length > 0;
}
