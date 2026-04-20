import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type DependencySeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface AgentDependencyEdge {
  blockingAgent: string;
  waitingAgent: string;
  blockedTickets: number;
  totalBlockingTickets: number;
  blockingScore: number;
  severity: DependencySeverity;
  recommendation: string;
}

export interface DependencyMapReport {
  projectId: string;
  analyzedAt: string;
  totalEdges: number;
  criticalEdges: number;
  independentAgents: number;
  agentDependencyEdges: AgentDependencyEdge[];
  aiSummary: string;
}

const FALLBACK_RECOMMENDATION =
  "Prioritize the blocking agent's tickets to unblock downstream work and reduce chain delays.";
const FALLBACK_SUMMARY =
  'Resolve blocking ticket chains to improve agent throughput and reduce inter-agent wait times.';

const EXCLUDE_STATUSES = ['done', 'cancelled'];

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}

function computeSeverity(score: number): DependencySeverity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

function severityOrder(s: DependencySeverity): number {
  return { critical: 0, high: 1, moderate: 2, low: 3 }[s];
}

function computeBlockingScore(blockedTickets: number, totalBlockingTickets: number): number {
  const raw = (blockedTickets / Math.max(1, totalBlockingTickets)) * 60 + blockedTickets * 8;
  return Math.min(100, Math.round(raw * 10) / 10);
}

export async function analyzeAgentDependencies(projectId: string): Promise<DependencyMapReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      blockedBy: tickets.blockedBy,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Map ticket id → assignedPersona for blocker lookup
  const idToPersona = new Map<string, string | null>();
  for (const t of allTickets) idToPersona.set(t.id, t.assignedPersona);

  // Active blocked tickets: blockedBy set, not done/cancelled, has assignedPersona
  const activeBlocked = allTickets.filter(
    (t) =>
      t.blockedBy != null &&
      !EXCLUDE_STATUSES.includes(t.status) &&
      t.assignedPersona != null,
  );

  const allPersonas = new Set<string>(
    allTickets.map((t) => t.assignedPersona).filter(Boolean) as string[],
  );

  if (activeBlocked.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalEdges: 0,
      criticalEdges: 0,
      independentAgents: allPersonas.size,
      agentDependencyEdges: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  // Accumulate edges: (blockingAgent, waitingAgent) → { blockedTickets count, set of blocker ticket IDs }
  type EdgeAcc = { blockingAgent: string; waitingAgent: string; blockedTickets: number; blockerIds: Set<string> };
  const edgeMap = new Map<string, EdgeAcc>();

  for (const t of activeBlocked) {
    const blockingAgent = idToPersona.get(t.blockedBy as string);
    if (!blockingAgent || blockingAgent === t.assignedPersona) continue;
    const key = `${blockingAgent}|||${t.assignedPersona}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { blockingAgent, waitingAgent: t.assignedPersona!, blockedTickets: 0, blockerIds: new Set() });
    }
    const acc = edgeMap.get(key)!;
    acc.blockedTickets++;
    acc.blockerIds.add(t.blockedBy as string);
  }

  if (edgeMap.size === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalEdges: 0,
      criticalEdges: 0,
      independentAgents: allPersonas.size,
      agentDependencyEdges: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  // Per blocking-agent total distinct blocking ticket IDs (across all edges)
  const agentBlockerIds = new Map<string, Set<string>>();
  for (const acc of edgeMap.values()) {
    if (!agentBlockerIds.has(acc.blockingAgent)) agentBlockerIds.set(acc.blockingAgent, new Set());
    for (const id of acc.blockerIds) agentBlockerIds.get(acc.blockingAgent)!.add(id);
  }

  type RawEdge = Omit<AgentDependencyEdge, 'recommendation'>;
  const rawEdges: RawEdge[] = [];

  for (const acc of edgeMap.values()) {
    const totalBlockingTickets = agentBlockerIds.get(acc.blockingAgent)?.size ?? 1;
    const blockingScore = computeBlockingScore(acc.blockedTickets, totalBlockingTickets);
    const severity = computeSeverity(blockingScore);
    rawEdges.push({
      blockingAgent: acc.blockingAgent,
      waitingAgent: acc.waitingAgent,
      blockedTickets: acc.blockedTickets,
      totalBlockingTickets,
      blockingScore,
      severity,
    });
  }

  rawEdges.sort((a, b) => {
    const diff = severityOrder(a.severity) - severityOrder(b.severity);
    return diff !== 0 ? diff : b.blockingScore - a.blockingScore;
  });

  // independentAgents count: personas with no edge (neither blocking nor waiting)
  const involvedAgents = new Set<string>();
  for (const e of rawEdges) {
    involvedAgents.add(e.blockingAgent);
    involvedAgents.add(e.waitingAgent);
  }
  const independentAgents = [...allPersonas].filter((p) => !involvedAgents.has(p)).length;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  // Batch AI recommendations (up to 4 per call)
  const recMap = new Map<string, string>();
  for (let i = 0; i < rawEdges.length; i += 4) {
    const batch = rawEdges.slice(i, i + 4);
    try {
      const desc = batch
        .map(
          (e) =>
            `Pair: ${e.blockingAgent}→${e.waitingAgent}, BlockedTickets: ${e.blockedTickets}, Score: ${e.blockingScore}, Severity: ${e.severity}`,
        )
        .join('\n');
      const prompt = `For each agent dependency pair below, write exactly one sentence recommending how to unblock (prioritize, reassign, or split). Output as JSON array [{pair, recommendation}] using "blockingAgent→waitingAgent" format as pair key.\n\n${desc}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const parsed = JSON.parse(extractJSON(text)) as Array<{ pair: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.pair && item.recommendation) recMap.set(item.pair, item.recommendation);
      }
    } catch (e) {
      console.warn('Dependency mapper batch AI failed, using fallback:', e);
    }
  }

  const agentDependencyEdges: AgentDependencyEdge[] = rawEdges.map((e) => ({
    ...e,
    recommendation:
      recMap.get(`${e.blockingAgent}→${e.waitingAgent}`) ?? FALLBACK_RECOMMENDATION,
  }));

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = rawEdges
      .slice(0, 5)
      .map(
        (e) =>
          `${e.blockingAgent}→${e.waitingAgent}: severity=${e.severity}, blockedTickets=${e.blockedTickets}, score=${e.blockingScore}`,
      )
      .join('\n');
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Identify the top blocking agent, explain the risk to throughput, and give one concrete action. Write 2-3 sentences.\n\n${summaryData}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Dependency mapper summary AI failed, using fallback:', e);
  }

  const criticalEdges = agentDependencyEdges.filter((e) => e.severity === 'critical').length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalEdges: agentDependencyEdges.length,
    criticalEdges,
    independentAgents,
    agentDependencyEdges,
    aiSummary,
  };
}
