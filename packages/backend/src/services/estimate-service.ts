import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, ne, desc as orderDesc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface EstimationResult {
  points: number | null;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  similarTickets: string[];
}

function fallback(): EstimationResult {
  return {
    points: null,
    confidence: 'low',
    reasoning: 'Unable to estimate',
    similarTickets: [],
  };
}

function toFibonacci(value: number): number | null {
  const fibSet = [1, 2, 3, 5, 8, 13];
  if (fibSet.includes(value)) return value;
  // round to nearest fibonacci
  let nearest = fibSet[0];
  let minDiff = Math.abs(value - fibSet[0]);
  for (const f of fibSet) {
    if (Math.abs(value - f) < minDiff) {
      minDiff = Math.abs(value - f);
      nearest = f;
    }
  }
  return nearest;
}

export async function estimateStoryPoints(ticketId: string): Promise<EstimationResult> {
  const targetTicket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (targetTicket.length === 0) return fallback();

  const t = targetTicket[0];

  const reference = await db.select({
    id: tickets.id,
    title: tickets.title,
    description: tickets.description,
    storyPoints: tickets.storyPoints,
    status: tickets.status,
    priority: tickets.priority,
  })
  .from(tickets)
  .where(and(eq(tickets.projectId, t.projectId), eq(tickets.status, 'done'), ne(tickets.id, t.id)))
  .orderBy(orderDesc(tickets.updatedAt))
  .limit(10);

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const ticketDesc = t.description ? `\nDescription: ${t.description}` : '';

  const refList = reference.map(rt => {
    const pts = rt.storyPoints ? `${rt.storyPoints} points` : 'no points';
    const refDesc = rt.description ? `\n    Description: ${rt.description}` : '';
    return `- [${rt.id}] "${rt.title}" (priority: ${rt.priority}, ${pts})${refDesc}`;
  }).join('\n');

  const prompt = `You are an agile story point estimator. Estimate story points for this ticket.

Ticket to estimate:
- ID: ${t.id}
- Title: ${t.title}
- Priority: ${t.priority}${ticketDesc}
- Current points: ${t.storyPoints ?? 'none'}

Reference completed tickets from same project:
${refList || '(none available)'}

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "points": <Fibonacci number: 1, 2, 3, 5, 8, or 13>,
  "confidence": "low" | "medium" | "high",
  "reasoning": "<brief explanation of the estimate>",
  "similarTickets": ["<id or title of reference ticket used for comparison>"]
}

Rules:
- Use Fibonacci scale only: 1, 2, 3, 5, 8, 13
- Higher points = more complexity, effort, uncertainty
- Compare against reference tickets for relative sizing
- If no reference tickets exist, estimate based on title/description alone
- reasoning: 2-3 sentences max
- similarTickets: list 1-5 tickets used as comparison reference`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return fallback();
  }

  let parsed: { points: number; confidence: string; reasoning: string; similarTickets: string[] };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback();
  }

  const points = parsed.points ? toFibonacci(parsed.points) : null;

  return {
    points,
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence)
      ? parsed.confidence as 'low' | 'medium' | 'high'
      : 'low',
    reasoning: parsed.reasoning || 'No reasoning provided',
    similarTickets: Array.isArray(parsed.similarTickets) ? parsed.similarTickets.slice(0, 5) : [],
  };
}
