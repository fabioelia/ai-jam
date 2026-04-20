import { db } from '../db/connection.js';
import { ticketNotes, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentHandoffRole {
  agentId: string;
  agentName: string;
  handoffsSent: number;
  handoffsReceived: number;
  avgContextScore: number;
  avgResolutionRate: number;
  handoffEfficiency: number;
  role: 'initiator' | 'receiver' | 'collaborator' | 'isolated';
}

export interface AgentHandoffQualityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalHandoffs: number;
    avgContextScore: number;
    avgResolutionRate: number;
    topSender: string;
    topReceiver: string;
    lowQualityHandoffCount: number;
  };
  agents: AgentHandoffRole[];
  insights: string[];
  recommendations: string[];
}

export function scoreHandoffContext(handoff: any): number {
  let score = 20;
  if (handoff.description && handoff.description.length > 100) score += 40;
  if (handoff.instructions || (handoff.content && handoff.content.includes('instruction'))) score += 20;
  if (handoff.priority) score += 10;
  if (handoff.acceptanceCriteria || handoff.criteria) score += 10;
  return Math.min(100, score);
}

export function classifyRole(sent: number, received: number): AgentHandoffRole['role'] {
  if (sent > received * 2 && sent >= 3) return 'initiator';
  if (received > sent * 2 && received >= 3) return 'receiver';
  if (sent >= 2 && received >= 2) return 'collaborator';
  return 'isolated';
}

export async function analyzeAgentHandoffQuality(projectId: string, sessions?: any[]): Promise<AgentHandoffQualityReport> {
  const generatedAt = new Date().toISOString();

  const rows = await db
    .select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      content: ticketNotes.content,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
    })
    .from(ticketNotes)
    .innerJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  const handoffRows = rows.filter(r => r.handoffFrom != null);

  // Per-agent aggregation
  const agentMap = new Map<string, {
    sent: any[];
    received: any[];
  }>();

  for (const row of handoffRows) {
    const from = row.handoffFrom!;
    const to = row.handoffTo ?? 'unknown';

    if (!agentMap.has(from)) agentMap.set(from, { sent: [], received: [] });
    if (!agentMap.has(to)) agentMap.set(to, { sent: [], received: [] });

    const contextScore = scoreHandoffContext({ description: row.content, content: row.content });
    agentMap.get(from)!.sent.push({ contextScore });
    agentMap.get(to)!.received.push({ contextScore });
  }

  const agents: AgentHandoffRole[] = [];

  for (const [agentId, data] of agentMap.entries()) {
    const handoffsSent = data.sent.length;
    const handoffsReceived = data.received.length;
    const avgContextScore = data.sent.length > 0
      ? Math.round(data.sent.reduce((s: number, h: any) => s + h.contextScore, 0) / data.sent.length)
      : 0;
    const avgResolutionRate = handoffsSent > 0 ? Math.round((handoffsSent / (handoffsSent + handoffsReceived || 1)) * 100) : 0;
    const handoffEfficiency = Math.min(100, (avgContextScore * 0.5) + (avgResolutionRate * 0.5));
    const role = classifyRole(handoffsSent, handoffsReceived);
    const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/_/g, ' ');

    agents.push({ agentId, agentName, handoffsSent, handoffsReceived, avgContextScore, avgResolutionRate, handoffEfficiency, role });
  }

  const totalHandoffs = handoffRows.length;
  const allContextScores = handoffRows.map(r => scoreHandoffContext({ description: r.content, content: r.content }));
  const avgContextScore = allContextScores.length > 0
    ? Math.round(allContextScores.reduce((a, b) => a + b, 0) / allContextScores.length)
    : 0;
  const lowQualityHandoffCount = allContextScores.filter(s => s < 50).length;

  const topSender = agents.sort((a, b) => b.handoffsSent - a.handoffsSent)[0]?.agentName ?? '';
  const topReceiver = [...agents].sort((a, b) => b.handoffsReceived - a.handoffsReceived)[0]?.agentName ?? '';

  const summary = {
    totalHandoffs,
    avgContextScore,
    avgResolutionRate: avgContextScore,
    topSender,
    topReceiver,
    lowQualityHandoffCount,
  };

  const insights: string[] = [`${totalHandoffs} handoffs analyzed across ${agents.length} agents.`];
  const recommendations: string[] = [
    'Ensure handoff descriptions exceed 100 characters for full context scoring.',
    'Include acceptance criteria in handoffs to improve context scores.',
  ];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });
    const prompt = `Handoff quality: ${totalHandoffs} handoffs, avgScore=${avgContextScore}, lowQuality=${lowQualityHandoffCount}. Provide JSON: {"insights": ["..."], "recommendations": ["..."]}`;
    const msg = await client.messages.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      try {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.insights) && parsed.insights.length > 0) insights.splice(0, insights.length, ...parsed.insights);
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations.splice(0, recommendations.length, ...parsed.recommendations);
      } catch { /* use defaults */ }
    }
  } catch { /* use defaults */ }

  return { projectId, generatedAt, summary, agents, insights, recommendations };
}
