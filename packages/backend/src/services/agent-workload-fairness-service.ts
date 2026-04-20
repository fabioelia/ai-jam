import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentFairnessMetrics {
  agentPersona: string;
  activeTickets: number;
  completedLast7d: number;
  workloadShare: number;
  idealShare: number;
  deviation: number;
  status: 'overloaded' | 'balanced' | 'underloaded';
}

export interface WorkloadFairnessReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentFairnessMetrics[];
  fairnessScore: number;
  totalActiveTickets: number;
  summary: string;
}

const FALLBACK_SUMMARY = 'Review agent workload distribution to ensure fair ticket allocation across the team.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function agentStatus(workloadShare: number, idealShare: number): 'overloaded' | 'balanced' | 'underloaded' {
  if (workloadShare > idealShare * 1.5) return 'overloaded';
  if (workloadShare < idealShare * 0.5) return 'underloaded';
  return 'balanced';
}

export async function analyzeWorkloadFairness(projectId: string): Promise<WorkloadFairnessReport> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
      ),
    );

  type AgentData = { active: typeof allTickets; done7d: typeof allTickets };
  const agentMap = new Map<string, AgentData>();

  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, { active: [], done7d: [] });
    const entry = agentMap.get(persona)!;
    if (t.status !== 'done') {
      entry.active.push(t);
    } else if (t.updatedAt >= sevenDaysAgo) {
      entry.done7d.push(t);
    }
  }

  // Only agents with >=1 active OR >=1 completion in 7d
  const qualifying = [...agentMap.entries()].filter(
    ([_, d]) => d.active.length > 0 || d.done7d.length > 0,
  );

  if (qualifying.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      fairnessScore: 100,
      totalActiveTickets: 0,
      summary: FALLBACK_SUMMARY,
    };
  }

  const totalActiveTickets = qualifying.reduce((sum, [_, d]) => sum + d.active.length, 0);
  const agentCount = qualifying.length;
  const idealShare = 100 / agentCount;

  const rawAgents: AgentFairnessMetrics[] = qualifying.map(([persona, d]) => {
    const activeTickets = d.active.length;
    const completedLast7d = d.done7d.length;
    const workloadShare = totalActiveTickets > 0 ? (activeTickets / totalActiveTickets) * 100 : 0;
    const deviation = Math.abs(workloadShare - idealShare);
    const status = agentStatus(workloadShare, idealShare);
    return {
      agentPersona: persona,
      activeTickets,
      completedLast7d,
      workloadShare: Math.round(workloadShare * 10) / 10,
      idealShare: Math.round(idealShare * 10) / 10,
      deviation: Math.round(deviation * 10) / 10,
      status,
    };
  });

  // Sort: overloaded → balanced → underloaded, then desc activeTickets within group
  const ORDER = { overloaded: 0, balanced: 1, underloaded: 2 };
  rawAgents.sort((a, b) => {
    const groupDiff = ORDER[a.status] - ORDER[b.status];
    if (groupDiff !== 0) return groupDiff;
    return b.activeTickets - a.activeTickets;
  });

  const avgDeviation = rawAgents.reduce((sum, a) => sum + a.deviation, 0) / rawAgents.length;
  const fairnessScore = Math.max(0, Math.round(100 - avgDeviation * 2));

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let summary = FALLBACK_SUMMARY;

  try {
    const statsData = JSON.stringify(rawAgents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      activeTickets: a.activeTickets,
      workloadShare: a.workloadShare,
      status: a.status,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze agent workload fairness (fairnessScore=${fairnessScore}). Give a 2-sentence summary: overall distribution health + which agents need rebalancing. Output JSON: {summary: string}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonStr = extractJSONFromText(text);
    const parsed = JSON.parse(jsonStr) as { summary: string };
    if (parsed.summary) summary = parsed.summary;
  } catch (e) {
    console.warn('Agent workload fairness AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents: rawAgents,
    fairnessScore,
    totalActiveTickets,
    summary,
  };
}
