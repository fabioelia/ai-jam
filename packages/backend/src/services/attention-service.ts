import { db } from '../db/connection.js';
import { attentionItems } from '../db/schema.js';
import { eq, and, sql, count } from 'drizzle-orm';
import { broadcastToBoard } from '../websocket/socket-server.js';

type AttentionItemType = 'transition_gate' | 'failed_session' | 'human_escalation' | 'stuck_ticket' | 'proposal_review';

interface CreateAttentionItemParams {
  projectId: string;
  featureId?: string;
  ticketId?: string;
  type: AttentionItemType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an attention item and broadcast to project board.
 */
export async function createAttentionItem(params: CreateAttentionItemParams) {
  const [item] = await db
    .insert(attentionItems)
    .values({
      projectId: params.projectId,
      featureId: params.featureId ?? null,
      ticketId: params.ticketId ?? null,
      type: params.type,
      title: params.title,
      description: params.description ?? null,
      metadata: params.metadata ?? null,
    })
    .returning();

  broadcastToBoard(params.projectId, 'attention:created', item);

  return item;
}

/**
 * List pending attention items for a project, optionally filtered by type.
 */
export async function listAttentionItems(projectId: string, type?: string) {
  const conditions = [
    eq(attentionItems.projectId, projectId),
    eq(attentionItems.status, 'pending'),
  ];

  if (type) {
    conditions.push(eq(attentionItems.type, type as AttentionItemType));
  }

  return db
    .select()
    .from(attentionItems)
    .where(and(...conditions))
    .orderBy(sql`${attentionItems.createdAt} desc`);
}

/**
 * Global count of pending attention items across all projects.
 */
export async function getPendingCount() {
  const [result] = await db
    .select({ count: count() })
    .from(attentionItems)
    .where(eq(attentionItems.status, 'pending'));

  return result?.count ?? 0;
}

/**
 * Resolve an attention item with optional note and user attribution.
 */
export async function resolveAttentionItem(id: string, resolvedBy?: string, resolutionNote?: string) {
  const updates: Record<string, unknown> = {
    status: 'resolved',
    resolvedAt: new Date(),
  };
  if (resolvedBy) updates.resolvedBy = resolvedBy;

  // Append resolution note to metadata if provided
  const [existing] = await db.select().from(attentionItems).where(eq(attentionItems.id, id));
  if (!existing) return null;

  if (resolutionNote) {
    const meta = (existing.metadata as Record<string, unknown>) || {};
    updates.metadata = { ...meta, resolutionNote };
  }

  const [updated] = await db
    .update(attentionItems)
    .set(updates)
    .where(eq(attentionItems.id, id))
    .returning();

  if (updated) {
    broadcastToBoard(updated.projectId, 'attention:resolved', updated);
  }

  return updated;
}

/**
 * Dismiss an attention item without action.
 */
export async function dismissAttentionItem(id: string, resolvedBy?: string) {
  const [updated] = await db
    .update(attentionItems)
    .set({
      status: 'dismissed',
      resolvedAt: new Date(),
      resolvedBy: resolvedBy ?? null,
    })
    .where(eq(attentionItems.id, id))
    .returning();

  if (updated) {
    broadcastToBoard(updated.projectId, 'attention:dismissed', updated);
  }

  return updated;
}
