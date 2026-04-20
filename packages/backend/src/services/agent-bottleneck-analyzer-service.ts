import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface StageBottleneck {
  stage: 'in_progress' | 'review' | 'qa' | 'acceptance';
  avgDwellMs: number;
  maxDwellMs: number;
  ticketCount: number;
  bottleneckSeverity: 'critical' | 'moderate' | 'low';
}

export interface AgentBottleneck {
  agentPersona: string;
  avgDwellMs: number;
  stalledTickets: number;
  totalAssigned: number;
  bottleneckScore: number;
  recommendation: string;
}

export interface BottleneckReport {
  projectId: string;
  analyzedAt: string;
  totalTickets: number;
  stalledTickets: number;
  criticalBottlenecks: number;
  stageBottlenecks: StageBottleneck[];
  agentBottlenecks: AgentBottleneck[];
  aiSummary: string;
}

const FALLBACK_RECOMMENDATION = 'Reduce concurrent ticket assignments to clear the bottleneck.';
const FALLBACK_SUMMARY = 'Identify stalled tickets and redistribute workload to unblock the pipeline.';
const STALL_THRESHOLD_MS = 259_200_000; // 72h
const CRITICAL_THRESHOLD_MS = 259_200_000; // 72h
const MODERATE_THRESHOLD_MS = 86_400_000; // 24h

const ACTIVE_STAGES = ['in_progress', 'review', 'qa', 'acceptance'] as const;
type ActiveStage = (typeof ACTIVE_STAGES)[number];

function computeSeverity(avgDwellMs: number): 'critical' | 'moderate' | 'low' {
  if (avgDwellMs > CRITICAL_THRESHOLD_MS) return 'critical';
  if (avgDwellMs >= MODERATE_THRESHOLD_MS) return 'moderate';
  return 'low';
}

export async function analyzeBottlenecks(projectId: string): Promise<BottleneckReport> {
  const now = new Date();
  const nowMs = now.getTime();

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const totalTickets = allTickets.length;

  // Stage dwell: group active-stage tickets by status
  const stageMap = new Map<ActiveStage, number[]>();
  for (const stage of ACTIVE_STAGES) stageMap.set(stage, []);

  for (const t of allTickets) {
    const status = t.status as ActiveStage;
    if (!ACTIVE_STAGES.includes(status)) continue;
    const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : nowMs;
    stageMap.get(status)!.push(nowMs - updated);
  }

  const stageBottlenecks: StageBottleneck[] = ACTIVE_STAGES.map((stage) => {
    const dwells = stageMap.get(stage)!;
    const ticketCount = dwells.length;
    const avgDwellMs = ticketCount === 0 ? 0 : dwells.reduce((a, b) => a + b, 0) / ticketCount;
    const maxDwellMs = ticketCount === 0 ? 0 : Math.max(...dwells);
    return {
      stage,
      avgDwellMs: Math.round(avgDwellMs),
      maxDwellMs: Math.round(maxDwellMs),
      ticketCount,
      bottleneckSeverity: computeSeverity(avgDwellMs),
    };
  });
  stageBottlenecks.sort((a, b) => b.avgDwellMs - a.avgDwellMs);

  // Agent analysis
  const agentMap = new Map<string, typeof allTickets>();
  for (const t of allTickets) {
    if (!t.assignedPersona) continue;
    const persona = t.assignedPersona as string;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t);
  }

  const agentData: Array<Omit<AgentBottleneck, 'recommendation'>> = [];

  for (const [persona, ts] of agentMap.entries()) {
    const totalAssigned = ts.length;
    const nonDoneActive = ts.filter((t) => t.status !== 'done' && t.status !== 'backlog');

    const avgDwellMs =
      nonDoneActive.length === 0
        ? 0
        : nonDoneActive.reduce((sum, t) => {
            const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : nowMs;
            return sum + (nowMs - updated);
          }, 0) / nonDoneActive.length;

    const stalledCount = nonDoneActive.filter((t) => {
      const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : nowMs;
      return nowMs - updated > STALL_THRESHOLD_MS;
    }).length;

    const rawScore = (stalledCount / totalAssigned) * 100;
    const bottleneckScore = Math.round(Math.min(rawScore, 100) * 10) / 10;

    agentData.push({
      agentPersona: persona,
      avgDwellMs: Math.round(avgDwellMs),
      stalledTickets: stalledCount,
      totalAssigned,
      bottleneckScore,
    });
  }

  const stalledAgents = agentData.filter((a) => a.stalledTickets > 0);
  const totalStalledTickets = stalledAgents.reduce((sum, a) => sum + a.stalledTickets, 0);

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < stalledAgents.length; i += 4) {
    const batch = stalledAgents.slice(i, i + 4);
    try {
      const batchDesc = batch
        .map(
          (a) =>
            `Agent: ${a.agentPersona}, StalledTickets: ${a.stalledTickets}, TotalAssigned: ${a.totalAssigned}, BottleneckScore: ${a.bottleneckScore}%`,
        )
        .join('\n');

      const prompt = `For each agent below, write exactly one sentence identifying the most likely cause of the bottleneck and recommend an action. Output as JSON array [{agent, recommendation}].\n\n${batchDesc}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ agent: string; recommendation: string }>;
        for (const item of parsed) {
          if (item.agent && item.recommendation) {
            recommendationMap.set(item.agent, item.recommendation);
          }
        }
      }
    } catch (e) {
      console.warn('Bottleneck analyzer batch AI failed, using fallback:', e);
    }
  }

  const agentBottlenecks: AgentBottleneck[] = stalledAgents
    .map((a) => ({
      ...a,
      recommendation: recommendationMap.get(a.agentPersona) ?? FALLBACK_RECOMMENDATION,
    }))
    .sort((a, b) => b.bottleneckScore - a.bottleneckScore);

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const criticalStages = stageBottlenecks.filter((s) => s.bottleneckSeverity === 'critical');
    const summaryData = [
      `Total tickets: ${totalTickets}, Stalled: ${totalStalledTickets}`,
      `Critical stages: ${criticalStages.map((s) => s.stage).join(', ') || 'none'}`,
      ...stageBottlenecks.map(
        (s) =>
          `Stage ${s.stage}: avg=${(s.avgDwellMs / 3_600_000).toFixed(1)}h, tickets=${s.ticketCount}, severity=${s.bottleneckSeverity}`,
      ),
    ].join('\n');

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize workflow bottlenecks in 2-3 sentences and identify the top priority fix.\n\n${summaryData}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Bottleneck analyzer summary AI failed, using fallback:', e);
  }

  const criticalBottlenecks = stageBottlenecks.filter(
    (s) => s.bottleneckSeverity === 'critical',
  ).length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalTickets,
    stalledTickets: totalStalledTickets,
    criticalBottlenecks,
    stageBottlenecks,
    agentBottlenecks,
    aiSummary,
  };
}
