import { db } from '../db';
import { tickets } from '../db/schema';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface SprintRisk {
  ticketId: string;
  title: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

interface SprintBottleneck {
  status: string;
  count: number;
  avgDaysSinceUpdate: number;
}

interface SprintAnalysis {
  healthScore: number;
  risks: SprintRisk[];
  bottlenecks: SprintBottleneck[];
  recommendations: string[];
  analyzedAt: string;
}

export async function analyzeSprintHealth(projectId: string): Promise<SprintAnalysis> {
  const activeTickets = await db.select().from(tickets)
    .where(eq(tickets.projectId, projectId));

  const doneTickets = activeTickets.filter(t => t.status === 'done');
  const workingTickets = activeTickets.filter(t => t.status !== 'done');

  if (workingTickets.length === 0) {
    return {
      healthScore: 100,
      risks: [],
      bottlenecks: [],
      recommendations: ['All tickets completed. Ready for next sprint.'],
      analyzedAt: new Date().toISOString()
    };
  }

  // Build ticket summary for AI
  const now = Date.now();
  const ticketSummary = workingTickets.map(t => {
    const daysSinceUpdate = Math.floor((now - (new Date(t.updatedAt || t.createdAt)).getTime()) / 86400000);
    return `- [${t.id}] "${t.title}" | status: ${t.status} | priority: ${t.priority} | days-since-update: ${daysSinceUpdate}`;
  }).join('\n');

  // Calculate bottlenecks by status
  const statusGroups: Record<string, typeof workingTickets> = {};
  for (const t of workingTickets) {
    if (!statusGroups[t.status]) statusGroups[t.status] = [];
    statusGroups[t.status].push(t);
  }

  const bottlenecks: SprintBottleneck[] = Object.entries(statusGroups)
    .map(([status, group]) => {
      const avgDays = group.reduce((sum, t) => {
        return sum + Math.floor((now - new Date(t.updatedAt || t.createdAt).getTime()) / 86400000);
      }, 0) / group.length;
      return { status, count: group.length, avgDaysSinceUpdate: Math.round(avgDays) };
    })
    .filter(b => b.avgDaysSinceUpdate > 2)
    .sort((a, b) => b.avgDaysSinceUpdate - a.avgDaysSinceUpdate);

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const prompt = `You are a sprint health analyzer. Analyze these active tickets and return a JSON health report.

Tickets (${workingTickets.length} active, ${doneTickets.length} done):
${ticketSummary}

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "healthScore": <0-100 integer, 100=all moving well, 0=critical>,
  "risks": [
    {"ticketId": "<id>", "title": "<short title>", "reason": "<why at risk>", "severity": "high|medium|low"}
  ],
  "recommendations": ["<actionable recommendation>"]
}

Rules:
- healthScore factors: % done, priority tickets stuck, days-since-update for high-priority items
- risks: max 5 tickets, focus on high-priority items stuck > 3 days or blocked dependencies
- recommendations: 3-5 concrete actionable items, be specific
- tickets stuck = not updated in 3+ days`;

  const response = await client.messages.create({
    model: process.env.AI_MODEL || 'qwen/qwen3-6b',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';

  let parsed: { healthScore: number; risks: SprintRisk[]; recommendations: string[] };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = {
      healthScore: 50,
      risks: [],
      recommendations: ['Unable to parse AI response. Check sprint manually.']
    };
  }

  return {
    healthScore: Math.max(0, Math.min(100, parsed.healthScore || 50)),
    risks: (parsed.risks || []).slice(0, 5),
    bottlenecks,
    recommendations: (parsed.recommendations || []).slice(0, 5),
    analyzedAt: new Date().toISOString()
  };
}
