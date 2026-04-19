import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface StandupReport {
  yesterday: string[];
  today: string[];
  blockers: string[];
  confidence: number;
  reasoning: string;
}

function fallback(): StandupReport {
  return {
    yesterday: [],
    today: [],
    blockers: [],
    confidence: 0,
    reasoning: 'Unable to generate standup report',
  };
}

export async function generateStandupReport(projectId: string): Promise<StandupReport> {
  const projectTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  if (projectTickets.length === 0) return fallback();

  const yesterdayTickets = projectTickets.filter(
    t => ['done', 'review', 'qa', 'acceptance'].includes(t.status),
  );
  const todayTickets = projectTickets.filter(t => t.status === 'in_progress');
  const blockedTickets = projectTickets.filter(
    t => t.status === 'blocked',
  );

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const formatTickets = (list: typeof projectTickets) =>
    list
      .map(t => `- [${t.id}] ${t.title} (priority: ${t.priority}${t.assignedPersona ? ` assigned: ${t.assignedPersona}` : ''})`)
      .join('\n');

  const prompt = `You are a scrum master. Given the current board state, generate a concise daily standup report.

Yesterday (completed/review/qa tickets):
${formatTickets(yesterdayTickets)}

Today (in-progress tickets):
${formatTickets(todayTickets)}

Blockers (blocked tickets):
${formatTickets(blockedTickets)}

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "yesterday": ["..."],
  "today": ["..."],
  "blockers": ["..."],
  "confidence": 0.8,
  "reasoning": "..."
}

Rules:
- Each section: 2-5 bullet points max
- Concise imperative summaries ("Fixed auth redirect", not "The authentication redirect was fixed by...")
- confidence: 0.0-1.0 based on data quality and clarity
- reasoning: 2-3 sentences explaining the assessment
- Do not invent work not listed in the tickets
- Be concise — standup format is <30 seconds to read`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return fallback();
  }

  let parsed: { yesterday: string[]; today: string[]; blockers: string[]; confidence: number; reasoning: string };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback();
  }

  const yesterday = Array.isArray(parsed.yesterday)
    ? parsed.yesterday.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const today = Array.isArray(parsed.today)
    ? parsed.today.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const blockers = Array.isArray(parsed.blockers)
    ? parsed.blockers.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];
  const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

  return {
    yesterday,
    today,
    blockers,
    confidence,
    reasoning: parsed.reasoning || 'No reasoning provided',
  };
}
