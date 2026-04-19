import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface SubtaskProposal {
  title: string;
  description: string;
  storyPoints: number;
}

interface SubtaskResult {
  subtasks: SubtaskProposal[];
  confidence: number;
  reasoning: string;
}

function fallback(): SubtaskResult {
  return {
    subtasks: [],
    confidence: 0,
    reasoning: 'Unable to generate sub-tasks',
  };
}

export async function generateSubtasks(ticketId: string): Promise<SubtaskResult> {
  const targetTicket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (targetTicket.length === 0) return fallback();

  const t = targetTicket[0];

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const ticketDesc = t.description ? `\nDescription: ${t.description}` : '';

  const prompt = `You are an agile task-breakdown assistant. Given a ticket, generate 3-8 concrete, independently implementable sub-tasks.

Ticket:
- Title: ${t.title}${ticketDesc}
- Type: ticket
- Labels: ${t.assignedPersona || 'none'}

Return JSON with:
{
  "subtasks": [{"title": "...", "description": "...", "storyPoints": 1|2|3|5|8}...]
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Rules:
- 3-8 sub-tasks, each with short imperative title (<=60 chars)
- description: 1-2 sentences
- storyPoints: Fibonacci 1/2/3/5/8, cap at 13, min 1
- Avoid overly granular sub-tasks ("Write unit tests" is fine, "Write test case 1" is not)
- reasoning: 2-3 sentences max`;

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

  let parsed: { subtasks: Array<{ title: string; description: string; storyPoints: number }>; confidence: number; reasoning: string };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback();
  }

  const rawSubtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];
  const subtasks = rawSubtasks
    .filter((s): s is { title: string; description: string; storyPoints: number } =>
      typeof s === 'object' &&
      s !== null &&
      typeof s.title === 'string' &&
      s.title.trim().length > 0 &&
      typeof s.description === 'string' &&
      (typeof s.storyPoints === 'number')
    )
    .map(s => ({
      title: s.title.trim(),
      description: s.description.trim(),
      storyPoints: Math.min(13, Math.max(1, Math.round(s.storyPoints))),
    }))
    .slice(0, 8);

  const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

  return {
    subtasks,
    confidence,
    reasoning: parsed.reasoning || 'No reasoning provided',
  };
}
