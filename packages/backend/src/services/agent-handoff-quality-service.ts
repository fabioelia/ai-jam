import { db } from '../db/connection.js';
import { ticketNotes, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentHandoffQualityMetrics {
  agentId: string;
  agentName: string;
  totalHandoffs: number;
  avgContextCompleteness: number;
  avgClarityScore: number;
  avgTimeliness: number;
  followUpRate: number;
  handoffScore: number;
  handoffTier: 'exemplary' | 'proficient' | 'adequate' | 'deficient';
}

export interface AgentHandoffQualityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgHandoffScore: number;
    bestHandoffAgent: string;
    worstHandoffAgent: string;
    highQualityHandoffCount: number;
  };
  agents: AgentHandoffQualityMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeHandoffScore(
  avgContextCompleteness: number,
  avgClarityScore: number,
  avgTimeliness: number,
  followUpRate: number,
): number {
  const base = (avgContextCompleteness + avgClarityScore + avgTimeliness) / 3;
  const penalty = followUpRate * 0.3;
  return Math.min(100, Math.max(0, Math.round(base - penalty)));
}

export function getHandoffTier(score: number): AgentHandoffQualityMetrics['handoffTier'] {
  if (score >= 80) return 'exemplary';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'adequate';
  return 'deficient';
}

function agentNameFromId(agentId: string): string {
  return agentId
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function analyzeAgentHandoffQuality(projectId: string): Promise<AgentHandoffQualityReport> {
  const rows = await db
    .select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      content: ticketNotes.content,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
    })
    .from(ticketNotes)
    .innerJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  const handoffRows = rows.filter(r => r.handoffFrom != null);

  // Per-agent aggregation
  const agentMap = new Map<string, { handoffs: any[] }>();

  for (const row of handoffRows) {
    const from = row.handoffFrom!;
    if (!agentMap.has(from)) agentMap.set(from, { handoffs: [] });

    const content = row.content ?? '';
    const contextCompleteness = Math.min(100, 20 + (content.length > 200 ? 50 : content.length > 100 ? 30 : 10) + (content.includes('context') ? 10 : 0) + (content.includes('status') ? 10 : 0));
    const clarityScore = Math.min(100, 30 + (content.length > 50 ? 20 : 0) + (content.includes('next') || content.includes('todo') ? 20 : 0) + (content.includes('complete') || content.includes('done') ? 15 : 0) + (content.includes('blocked') ? 15 : 0));
    // Timeliness proxy: full score if handoff has a to-agent, reduced if missing
    const timeliness = row.handoffTo ? 80 : 50;
    // Follow-up proxy: short content suggests incomplete handoff
    const isFollowUp = content.length < 50;

    agentMap.get(from)!.handoffs.push({ contextCompleteness, clarityScore, timeliness, isFollowUp });
  }

  const agents: AgentHandoffQualityMetrics[] = [];

  for (const [agentId, data] of agentMap.entries()) {
    const totalHandoffs = data.handoffs.length;
    const avg = (field: string) => totalHandoffs > 0
      ? Math.round(data.handoffs.reduce((s: number, h: any) => s + h[field], 0) / totalHandoffs)
      : 0;

    const avgContextCompleteness = avg('contextCompleteness');
    const avgClarityScore = avg('clarityScore');
    const avgTimeliness = avg('timeliness');
    const followUpRate = totalHandoffs > 0
      ? Math.round((data.handoffs.filter((h: any) => h.isFollowUp).length / totalHandoffs) * 100)
      : 0;

    const handoffScore = computeHandoffScore(avgContextCompleteness, avgClarityScore, avgTimeliness, followUpRate);
    const handoffTier = getHandoffTier(handoffScore);

    agents.push({
      agentId,
      agentName: agentNameFromId(agentId),
      totalHandoffs,
      avgContextCompleteness,
      avgClarityScore,
      avgTimeliness,
      followUpRate,
      handoffScore,
      handoffTier,
    });
  }

  agents.sort((a, b) => b.handoffScore - a.handoffScore);

  const totalAgents = agents.length;
  const avgHandoffScore = totalAgents > 0
    ? Math.round(agents.reduce((s, a) => s + a.handoffScore, 0) / totalAgents)
    : 0;
  const bestHandoffAgent = agents.length > 0 ? agents[0].agentName : '';
  const worstHandoffAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const highQualityHandoffCount = agents.filter(a => a.handoffTier === 'exemplary' || a.handoffTier === 'proficient').length;

  const insights: string[] = [`${handoffRows.length} handoffs analyzed across ${totalAgents} agents.`];
  const recommendations: string[] = [
    'Provide detailed context (>200 chars) to maximize completeness scores.',
    'Always specify the receiving agent to improve timeliness scores.',
  ];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.handoffScore}, tier=${a.handoffTier}, followUpRate=${a.followUpRate}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Analyze handoff quality:\n${agentSummary}\nProvide JSON: {"insights": ["..."], "recommendations": ["..."]}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (Array.isArray(parsed.insights) && parsed.insights.length > 0) insights.splice(0, insights.length, ...parsed.insights);
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations.splice(0, recommendations.length, ...parsed.recommendations);
    }
  } catch {
    // use defaults
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: { totalAgents, avgHandoffScore, bestHandoffAgent, worstHandoffAgent, highQualityHandoffCount },
    agents,
    insights,
    recommendations,
  };
}
