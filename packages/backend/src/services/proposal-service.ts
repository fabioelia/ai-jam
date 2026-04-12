import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { ticketProposals, tickets, epics, features } from '../db/schema.js';
import { broadcastToBoard, broadcastToFeature } from '../websocket/socket-server.js';

/**
 * Approve a proposal and create the corresponding ticket in backlog.
 * Shared by: auto-approve (text-parse + MCP API) and manual approve endpoint.
 */
export async function approveProposal(
  proposalId: string,
  userId: string,
  options?: {
    ticketData?: Record<string, unknown>;
    source?: string;
  },
) {
  const [proposal] = await db
    .select()
    .from(ticketProposals)
    .where(eq(ticketProposals.id, proposalId));
  if (!proposal) throw new Error('Proposal not found');

  const data = (options?.ticketData || proposal.ticketData) as Record<string, unknown>;

  // Get feature for projectId
  const [feature] = await db
    .select()
    .from(features)
    .where(eq(features.id, proposal.featureId));
  if (!feature) throw new Error('Feature not found');

  // Resolve or create epic
  let epicId: string | null = null;
  if (data.epicTitle) {
    const [existingEpic] = await db
      .select()
      .from(epics)
      .where(and(eq(epics.featureId, proposal.featureId), eq(epics.title, data.epicTitle as string)));

    if (existingEpic) {
      epicId = existingEpic.id;
    } else {
      const [newEpic] = await db
        .insert(epics)
        .values({
          featureId: proposal.featureId,
          title: data.epicTitle as string,
          color: (data.epicColor as string) || null,
        })
        .returning();
      epicId = newEpic.id;

      broadcastToBoard(feature.projectId, 'board:epic:created', { epic: newEpic });
    }
  }

  // Create ticket in backlog
  const ticketSource = options?.source || proposal.source;
  const [ticket] = await db
    .insert(tickets)
    .values({
      featureId: proposal.featureId,
      projectId: feature.projectId,
      epicId,
      title: data.title as string,
      description: (data.description as string) || null,
      priority: (data.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      storyPoints: (data.storyPoints as number) || null,
      createdBy: userId,
      source: ticketSource,
    })
    .returning();

  // Mark proposal approved
  await db
    .update(ticketProposals)
    .set({ status: 'approved', resolvedAt: new Date() })
    .where(eq(ticketProposals.id, proposal.id));

  // Broadcast events
  broadcastToBoard(feature.projectId, 'board:ticket:created', { ticket });
  broadcastToFeature(proposal.featureId, 'proposal:approved', {
    proposalId: proposal.id,
    ticketId: ticket.id,
  });

  return { proposal: { ...proposal, status: 'approved' as const }, ticket };
}
