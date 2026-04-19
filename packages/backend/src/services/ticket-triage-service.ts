import { db } from '../db/connection.js';
import { tickets, epics, features } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface TriageResult {
  ticketId: string;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  suggestedStoryPoints: number;
  suggestedEpicId: string | null;
  suggestedEpicName: string | null;
  suggestedAssignee: string | null;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  analyzedAt: string;
}

function suggestPriority(title: string, description: string): 'critical' | 'high' | 'medium' | 'low' {
  const text = (title + ' ' + (description || '')).toLowerCase();
  if (/critical|urgent|crash|broken|outage/.test(text)) return 'critical';
  if (/bug|fix|error|fail/.test(text)) return 'high';
  if (/improve|enhance|optimize/.test(text)) return 'medium';
  return 'low';
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function suggestStoryPoints(description: string): number {
  const words = countWords(description || '');
  if (words < 20) return 1;
  if (words < 50) return 2;
  if (words < 100) return 3;
  if (words < 200) return 5;
  return 8;
}

function suggestConfidence(description: string): 'high' | 'medium' | 'low' {
  const words = countWords(description || '');
  if (words > 50) return 'high';
  if (words >= 20) return 'medium';
  return 'low';
}

function suggestEpic(
  ticketTitle: string,
  projectEpics: Array<{ id: string; title: string }>,
): { epicId: string | null; epicName: string | null } {
  if (projectEpics.length === 0) return { epicId: null, epicName: null };

  const titleWords = ticketTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let bestEpic: { id: string; title: string } | null = null;
  let bestScore = -1;

  for (const epic of projectEpics) {
    const epicWords = epic.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const overlap = titleWords.filter((w) => epicWords.includes(w)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestEpic = epic;
    }
  }

  // If bestScore is 0, still return first epic if there's only one, else null if no overlap
  if (bestScore === 0 && projectEpics.length > 1) {
    // pick first epic as fallback when no overlap but epics exist
    return { epicId: projectEpics[0].id, epicName: projectEpics[0].title };
  }

  if (!bestEpic) return { epicId: null, epicName: null };
  return { epicId: bestEpic.id, epicName: bestEpic.title };
}

function suggestAssignee(
  projectTickets: Array<{ priority: string; assignedPersona: string | null }>,
  suggestedPriority: string,
): string | null {
  const samePriority = projectTickets.filter(
    (t) => t.priority === suggestedPriority && t.assignedPersona != null,
  );

  if (samePriority.length === 0) return null;

  const freq: Record<string, number> = {};
  for (const t of samePriority) {
    const key = t.assignedPersona!;
    freq[key] = (freq[key] || 0) + 1;
  }

  let bestAssignee: string | null = null;
  let bestCount = 0;
  for (const [assignee, count] of Object.entries(freq)) {
    if (count > bestCount) {
      bestCount = count;
      bestAssignee = assignee;
    }
  }

  return bestAssignee;
}

export async function triageTicket(ticketId: string): Promise<TriageResult | null> {
  // 1. Query ticket by ID
  const ticketRows = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (ticketRows.length === 0) return null;
  const ticket = ticketRows[0];

  const { projectId, title, description } = ticket;

  // 2. Query project's epics (via features)
  const projectFeatures = await db
    .select({ id: features.id })
    .from(features)
    .where(eq(features.projectId, projectId));

  const featureIds = projectFeatures.map((f) => f.id);

  let projectEpics: Array<{ id: string; title: string }> = [];
  for (const featureId of featureIds) {
    const featureEpics = await db
      .select({ id: epics.id, title: epics.title })
      .from(epics)
      .where(eq(epics.featureId, featureId));
    projectEpics = projectEpics.concat(featureEpics);
  }

  // 3. Query existing tickets for assignee patterns
  const projectTickets = await db
    .select({ priority: tickets.priority, assignedPersona: tickets.assignedPersona })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  // 4. Priority suggestion
  const suggestedPriority = suggestPriority(title, description || '');

  // 5. Story point suggestion
  const suggestedStoryPoints = suggestStoryPoints(description || '');

  // 6. Confidence
  const confidence = suggestConfidence(description || '');

  // 7. Epic suggestion
  const { epicId: suggestedEpicId, epicName: suggestedEpicName } = suggestEpic(title, projectEpics);

  // 8. Assignee suggestion
  const suggestedAssignee = suggestAssignee(projectTickets, suggestedPriority);

  // 9. AI reasoning
  let reasoning = 'Triage based on heuristic analysis';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `You are an AI triage assistant. Analyze this ticket and provide a 2-3 sentence explanation of the triage suggestions.

Ticket Title: ${title}
Description: ${description || '(none)'}
Suggested Priority: ${suggestedPriority}
Suggested Story Points: ${suggestedStoryPoints}
${suggestedEpicName ? `Suggested Epic: ${suggestedEpicName}` : ''}
${suggestedAssignee ? `Suggested Assignee: ${suggestedAssignee}` : ''}

Provide a brief, clear reasoning for these suggestions in 2-3 sentences.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) reasoning = content;
  } catch (e) {
    console.warn('AI triage reasoning failed, using heuristic fallback:', e);
    reasoning = 'Triage based on heuristic analysis';
  }

  return {
    ticketId,
    suggestedPriority,
    suggestedStoryPoints,
    suggestedEpicId,
    suggestedEpicName,
    suggestedAssignee,
    reasoning,
    confidence,
    analyzedAt: new Date().toISOString(),
  };
}
