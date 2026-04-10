import { db } from '../db/connection.js';
import { chatMessages, chatSessions, ticketProposals, epics } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { broadcastToFeature } from '../websocket/socket-server.js';

/**
 * Structured action patterns Claude emits during planning.
 */
const ACTION_PATTERNS = {
  PROPOSE_TICKETS: /PROPOSE_TICKETS:\s*(\[[\s\S]*?\])\s*(?:\n|$)/,
  PROPOSE_EPIC: /PROPOSE_EPIC:\s*(\{[\s\S]*?\})\s*(?:\n|$)/,
  UPDATE_TICKET: /UPDATE_TICKET:\s*(\{[\s\S]*?\})\s*(?:\n|$)/,
};

export interface ParsedAction {
  type: 'PROPOSE_TICKETS' | 'PROPOSE_EPIC' | 'UPDATE_TICKET';
  data: unknown;
}

/**
 * Parse structured actions from Claude's output text.
 */
export function parseStructuredActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];

  for (const [type, pattern] of Object.entries(ACTION_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        actions.push({ type: type as ParsedAction['type'], data });
      } catch {
        console.warn(`[planning-service] Failed to parse ${type} action JSON:`, match[1].slice(0, 200));
      }
    }
  }

  return actions;
}

/**
 * Process a Claude assistant message — extract actions, save message,
 * create proposals, and broadcast events.
 */
export async function processAssistantMessage(
  chatSessionId: string,
  content: string,
): Promise<void> {
  // Get session to find featureId
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, chatSessionId));
  if (!session) return;

  // Parse actions
  const actions = parseStructuredActions(content);

  // Save the assistant message
  const [message] = await db
    .insert(chatMessages)
    .values({
      chatSessionId,
      role: 'assistant',
      content,
      structuredActions: actions.length > 0 ? actions : null,
    })
    .returning();

  // Broadcast the chat message
  broadcastToFeature(session.featureId, 'chat:message', {
    sessionId: chatSessionId,
    role: 'assistant',
    content,
    structuredActions: actions.length > 0 ? actions : undefined,
  });

  // Process each action
  for (const action of actions) {
    switch (action.type) {
      case 'PROPOSE_EPIC': {
        const epicData = action.data as { title: string; description?: string; color?: string };
        await handleProposeEpic(session.featureId, epicData);
        break;
      }

      case 'PROPOSE_TICKETS': {
        const ticketsData = action.data as Array<{
          title: string;
          description: string;
          epicTitle?: string;
          priority?: string;
          storyPoints?: number;
          acceptanceCriteria?: string[];
        }>;
        await handleProposeTickets(chatSessionId, session.featureId, message.id, ticketsData);
        break;
      }

      case 'UPDATE_TICKET': {
        // TODO: Phase 5 — update existing ticket proposal
        break;
      }
    }
  }
}

async function handleProposeEpic(
  featureId: string,
  data: { title: string; description?: string; color?: string },
) {
  // Check if epic already exists
  const existing = await db
    .select()
    .from(epics)
    .where(eq(epics.featureId, featureId));

  const alreadyExists = existing.some((e) => e.title === data.title);
  if (alreadyExists) return;

  const [epic] = await db
    .insert(epics)
    .values({
      featureId,
      title: data.title,
      description: data.description || null,
      color: data.color || null,
    })
    .returning();

  broadcastToFeature(featureId, 'board:epic:created', { epic });
}

async function handleProposeTickets(
  chatSessionId: string,
  featureId: string,
  messageId: string,
  ticketsData: Array<{
    title: string;
    description: string;
    epicTitle?: string;
    priority?: string;
    storyPoints?: number;
    acceptanceCriteria?: string[];
  }>,
) {
  for (const ticketData of ticketsData) {
    // Build the description with acceptance criteria
    let fullDescription = ticketData.description || '';
    if (ticketData.acceptanceCriteria?.length) {
      fullDescription += '\n\n## Acceptance Criteria\n';
      for (const criterion of ticketData.acceptanceCriteria) {
        fullDescription += `- [ ] ${criterion}\n`;
      }
    }

    const proposalData = {
      title: ticketData.title,
      description: fullDescription,
      epicTitle: ticketData.epicTitle,
      priority: ticketData.priority || 'medium',
      storyPoints: ticketData.storyPoints,
      acceptanceCriteria: ticketData.acceptanceCriteria,
    };

    const [proposal] = await db
      .insert(ticketProposals)
      .values({
        chatSessionId,
        featureId,
        proposedByMessageId: messageId,
        status: 'pending',
        ticketData: proposalData,
      })
      .returning();

    broadcastToFeature(featureId, 'proposal:created', {
      proposalId: proposal.id,
      ticketData: proposalData,
    });
  }
}
