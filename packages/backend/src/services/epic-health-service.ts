import { db } from '../db/connection.js';
import { epics, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface EpicHealthResult {
  epicId: string;
  epicTitle: string;
  totalTickets: number;
  healthScore: number;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'healthy';
  dimensions: {
    completeness: number;
    velocity: number;
    readiness: number;
    scopeRisk: number;
  };
  ticketBreakdown: {
    idea: number;
    backlog: number;
    inProgress: number;
    review: number;
    done: number;
  };
  narrative: string;
  topRisk: string;
  analyzedAt: string;
}

function extractJSONFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

export async function analyzeEpicHealth(epicId: string): Promise<EpicHealthResult | null> {
  const epicRows = await db.select().from(epics).where(eq(epics.id, epicId));
  if (epicRows.length === 0) return null;

  const epic = epicRows[0];
  const allTickets = await db.select().from(tickets).where(eq(tickets.epicId, epicId));
  const totalTickets = allTickets.length;

  // Ticket breakdown by status
  const breakdown = { idea: 0, backlog: 0, inProgress: 0, review: 0, done: 0 };
  for (const t of allTickets) {
    const s = t.status as string;
    if (s === 'done') breakdown.done++;
    else if (s === 'review' || s === 'qa' || s === 'acceptance') breakdown.review++;
    else if (s === 'in_progress') breakdown.inProgress++;
    else if (s === 'backlog') breakdown.backlog++;
    else breakdown.idea++;
  }

  if (totalTickets === 0) {
    return {
      epicId,
      epicTitle: epic.title,
      totalTickets: 0,
      healthScore: 0,
      riskLevel: 'critical',
      dimensions: { completeness: 0, velocity: 0, readiness: 0, scopeRisk: 0 },
      ticketBreakdown: breakdown,
      narrative: 'No tickets found for this epic.',
      topRisk: 'Epic has no defined work items.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // Completeness: % tickets in done/review * 80 + 20 bonus if all have desc + ACs
  const doneOrReview = breakdown.done + breakdown.review;
  const completenessBase = (doneOrReview / totalTickets) * 80;
  const allDefined = allTickets.every(t => t.description && Array.isArray(t.acceptanceCriteria) && t.acceptanceCriteria.length > 0);
  const completeness = allDefined ? completenessBase + 20 : completenessBase;

  // Scope risk: ratio of tickets added >3 days after epic.createdAt, scaled *200, capped 0-100
  const epicCreatedAt = epic.createdAt.getTime();
  const ticketsAddedLate = allTickets.filter(t => t.createdAt.getTime() - epicCreatedAt > 3 * 24 * 60 * 60 * 1000).length;
  const scopeRisk = Math.min(100, (ticketsAddedLate / totalTickets) * 200);

  // Velocity: done / (inProgress + review + done); 0 if denominator=0
  const velocityDenom = breakdown.done + breakdown.inProgress + breakdown.review;
  const velocity = velocityDenom > 0 ? (breakdown.done / velocityDenom) * 100 : 0;

  // Readiness: % tickets meeting >=2 of 3: storyPoints>0, description>=50chars, has ACs
  let readyCount = 0;
  for (const t of allTickets) {
    let criteriaMet = 0;
    if ((t.storyPoints ?? 0) > 0) criteriaMet++;
    if (t.description && t.description.length >= 50) criteriaMet++;
    if (Array.isArray(t.acceptanceCriteria) && t.acceptanceCriteria.length > 0) criteriaMet++;
    if (criteriaMet >= 2) readyCount++;
  }
  const readiness = (readyCount / totalTickets) * 100;

  // Health score: completeness*0.40 + velocity*0.25 + readiness*0.20 + (100-scopeRisk)*0.15
  const healthScore = (completeness * 0.40) + (velocity * 0.25) + (readiness * 0.20) + ((100 - scopeRisk) * 0.15);

  // Risk level
  let riskLevel: EpicHealthResult['riskLevel'];
  if (healthScore >= 85) riskLevel = 'healthy';
  else if (healthScore >= 65) riskLevel = 'on_track';
  else if (healthScore >= 40) riskLevel = 'at_risk';
  else riskLevel = 'critical';

  // AI call for narrative and topRisk
  let narrative = '';
  let topRisk = '';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `An epic health report:
- Epic: "${epic.title}"
- Total tickets: ${totalTickets}
- Status breakdown: ${JSON.stringify(breakdown)}
- Dimensions (0-100): completeness=${completeness.toFixed(0)}, velocity=${velocity.toFixed(0)}, readiness=${readiness.toFixed(0)}, scopeRisk=${scopeRisk.toFixed(0)}

Return ONLY JSON:
{"narrative": "<2-3 sentence summary>", "topRisk": "<single biggest risk>"}
`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = extractJSONFromText(content);
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as { narrative: string; topRisk: string };
      narrative = parsed.narrative || '';
      topRisk = parsed.topRisk || '';
    }
  } catch (e) {
    console.warn('Epic health AI failed:', e);
    narrative = `AI unavailable — showing heuristic analysis. Health score ${Math.round(healthScore)} based on completeness, velocity, readiness, and scope risk metrics.`;
    topRisk = 'Unable to assess risks automatically.';
  }

  return {
    epicId,
    epicTitle: epic.title,
    totalTickets,
    healthScore: Math.round(healthScore),
    riskLevel,
    dimensions: {
      completeness: Math.round(completeness),
      velocity: Math.round(velocity),
      readiness: Math.round(readiness),
      scopeRisk: Math.round(scopeRisk),
    },
    ticketBreakdown: breakdown,
    narrative,
    topRisk,
    analyzedAt: new Date().toISOString(),
  };
}
