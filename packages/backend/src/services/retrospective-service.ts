import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface Retrospective {
  wentWell: string[];
  improvements: string[];
  actionItems: string[];
  velocity: { planned: number; completed: number };
  confidence: number;
  reasoning: string;
}

function fallback(): Retrospective {
  return {
    wentWell: [],
    improvements: [],
    actionItems: [],
    velocity: { planned: 0, completed: 0 },
    confidence: 0,
    reasoning: 'Unable to generate retrospective',
  };
}

export async function generateRetrospective(projectId: string): Promise<Retrospective> {
  const projectTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  if (projectTickets.length === 0) return fallback();

  const completedTickets = projectTickets.filter(
    t => ['done', 'review', 'qa', 'acceptance'].includes(t.status),
  );
  const inProgressTickets = projectTickets.filter(t => t.status === 'in_progress');
  const backlogTickets = projectTickets.filter(t => t.status === 'backlog');

  const plannedPoints = projectTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const completedPoints = completedTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const formatTickets = (list: typeof projectTickets) =>
    list
      .map(t => `- [${t.id}] ${t.title} (priority: ${t.priority}, points: ${t.storyPoints ?? 0}${t.assignedPersona ? `, assigned: ${t.assignedPersona}` : ''})`)
      .join('\n');

  const prompt = `You are a scrum master. Given the current sprint board state, generate a structured retrospective report.

COMPLETED tickets (done/review/qa/acceptance) — candidates for "Went Well":
${formatTickets(completedTickets)}

IN PROGRESS tickets (incomplete work) — candidates for "Needs Improvement":
${formatTickets(inProgressTickets)}

BACKLOG tickets (not started) — candidates for "Needs Improvement":
${formatTickets(backlogTickets)}

Velocity: ${completedPoints} of ${plannedPoints} story points completed.

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "wentWell": ["..."],
  "improvements": ["..."],
  "actionItems": ["..."],
  "velocity": { "planned": ${plannedPoints}, "completed": ${completedPoints} },
  "confidence": 0.8,
  "reasoning": "..."
}

Rules:
- "wentWell": 2-4 items for completed/delivered work, especially on-time items
- "improvements": 2-4 items for incomplete/blocked work with root cause hints
- "actionItems": 2-4 specific, actionable recommendations for next sprint (not generic advice)
- "velocity": must match the numbers above — planned = total points, completed = done points
- confidence: 0.0-1.0 based on data quality and clarity
- reasoning: 2-3 sentences explaining the assessment
- Each point concise — retrospective format is <2 minutes to read
- Do not invent work not listed in the tickets`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return fallback();
  }

  let parsed: {
    wentWell: string[];
    improvements: string[];
    actionItems: string[];
    velocity: { planned: number; completed: number };
    confidence: number;
    reasoning: string;
  };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback();
  }

  const wentWell = Array.isArray(parsed.wentWell)
    ? parsed.wentWell.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const improvements = Array.isArray(parsed.improvements)
    ? parsed.improvements.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const actionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const velocity = {
    planned: typeof parsed.velocity?.planned === 'number' ? parsed.velocity.planned : plannedPoints,
    completed: typeof parsed.velocity?.completed === 'number' ? parsed.velocity.completed : completedPoints,
  };
  const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

  return {
    wentWell,
    improvements,
    actionItems,
    velocity,
    confidence,
    reasoning: parsed.reasoning || 'No reasoning provided',
  };
}
