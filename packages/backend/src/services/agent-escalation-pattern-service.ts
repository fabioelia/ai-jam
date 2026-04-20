import { db } from '../db/connection.js';
import { tickets, ticketNotes, agentSessions } from '../db/schema.js';
import { and, eq, isNotNull, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';

// FEAT-120 types
export interface AgentEscalationPatternMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  escalatedTasks: number;
  escalationRate: number;
  unnecessaryEscalations: number;
  avgResolutionTime: number;
  escalationScore: number;
  escalationTier: 'autonomous' | 'measured' | 'dependent' | 'over-reliant';
}

export interface AgentEscalationPatternReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgEscalationScore: number;
    mostAutonomous: string;
    overReliantAgents: number;
    avgEscalationRate: number;
  };
  agents: AgentEscalationPatternMetrics[];
  insights: string[];
  recommendations: string[];
}

export type DrizzleDb = NodePgDatabase<typeof schema>;

export function computeEscalationScore(
  escalationRate: number,
  unnecessaryEscalations: number,
  avgResolutionTime: number,
): number {
  let score = (1 - escalationRate) * 100;
  if (unnecessaryEscalations === 0) score += 10;
  if (avgResolutionTime > 60) score -= 15;
  return Math.max(0, Math.min(100, score));
}

export function escalationTier(score: number): AgentEscalationPatternMetrics['escalationTier'] {
  if (score >= 80) return 'autonomous';
  if (score >= 60) return 'measured';
  if (score >= 40) return 'dependent';
  return 'over-reliant';
}

export async function analyzeAgentEscalationPatterns(
  _db: DrizzleDb,
  projectId: string,
): Promise<AgentEscalationPatternReport> {
  const now = new Date().toISOString();

  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let sessions: { personaType: string; status: string; startedAt: Date | null; completedAt: Date | null }[] = [];

  if (ticketIds.length > 0) {
    sessions = await db
      .select({
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (sessions.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: { totalAgents: 0, avgEscalationScore: 0, mostAutonomous: '', overReliantAgents: 0, avgEscalationRate: 0 },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  const sessionsByAgent = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const agents: AgentEscalationPatternMetrics[] = [];

  for (const [personaType, agentSess] of sessionsByAgent.entries()) {
    const totalTasks = agentSess.length;
    const escalatedTasks = agentSess.filter((s) => s.status === 'failed').length;
    const escalationRate = totalTasks > 0 ? escalatedTasks / totalTasks : 0;
    const unnecessaryEscalations = 0;

    const durations: number[] = [];
    for (const s of agentSess) {
      if (s.startedAt && s.completedAt) {
        durations.push((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
      }
    }
    const avgResolutionTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const escScore = computeEscalationScore(escalationRate, unnecessaryEscalations, avgResolutionTime);
    const tier = escalationTier(escScore);

    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalTasks,
      escalatedTasks,
      escalationRate: Math.round(escalationRate * 100),
      unnecessaryEscalations,
      avgResolutionTime: Math.round(avgResolutionTime),
      escalationScore: Math.round(escScore),
      escalationTier: tier,
    });
  }

  agents.sort((a, b) => b.escalationScore - a.escalationScore);

  const avgEscalationScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.escalationScore, 0) / agents.length)
    : 0;
  const mostAutonomous = agents.length > 0 ? agents[0].agentName : '';
  const overReliantAgents = agents.filter((a) => a.escalationTier === 'over-reliant').length;
  const avgEscalationRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.escalationRate, 0) / agents.length)
    : 0;

  const insights: string[] = [];
  if (overReliantAgents > 0) insights.push(`${overReliantAgents} agent(s) are over-reliant on escalation.`);
  const autonomous = agents.filter((a) => a.escalationTier === 'autonomous');
  if (autonomous.length > 0) insights.push(`${autonomous.length} agent(s) operate autonomously.`);

  const recommendations: string[] = [];
  if (overReliantAgents > 0) recommendations.push('Review and reduce unnecessary escalations for over-reliant agents.');
  recommendations.push('Encourage autonomous decision-making for low-risk tasks.');

  return {
    projectId,
    generatedAt: now,
    summary: { totalAgents: agents.length, avgEscalationScore, mostAutonomous, overReliantAgents, avgEscalationRate },
    agents,
    insights,
    recommendations,
  };
}

export interface EscalationChain {
  fromAgent: string;
  toAgent: string;
  count: number;
}

export interface EscalationHotspot {
  agentPersona: string;
  escalationCount: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface EscalationPatternReport {
  projectId: string;
  analyzedAt: string;
  chains: EscalationChain[];
  hotspots: EscalationHotspot[];
  circularPatterns: string[][];
  totalEscalations: number;
  avgChainLength: number;
  aiSummary: string;
  aiRecommendations: string[];
}

const FALLBACK_SUMMARY = 'Review escalation patterns to identify bottlenecks and improve agent handoff processes.';
const FALLBACK_RECOMMENDATIONS = ['Investigate agents with high escalation rates and consider redistributing workload.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function detectCycles(chains: EscalationChain[]): string[][] {
  // Build adjacency list
  const graph = new Map<string, Set<string>>();
  for (const chain of chains) {
    if (!graph.has(chain.fromAgent)) graph.set(chain.fromAgent, new Set());
    graph.get(chain.fromAgent)!.add(chain.toAgent);
  }

  const cycles: string[][] = [];
  const seen = new Set<string>();

  function dfs(path: string[], visited: Set<string>): void {
    if (cycles.length >= 10) return;
    const current = path[path.length - 1];
    const neighbors = graph.get(current) || new Set();
    for (const neighbor of neighbors) {
      const cycleStart = path.indexOf(neighbor);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        if (cycle.length >= 2 && cycle.length <= 5) {
          // Normalize: start with lex-smallest
          const minIdx = cycle.indexOf([...cycle].sort()[0]);
          const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          const key = normalized.join('->');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(normalized);
          }
        }
      } else if (!visited.has(neighbor) && path.length < 5) {
        visited.add(neighbor);
        dfs([...path, neighbor], visited);
        visited.delete(neighbor);
      }
    }
  }

  const allAgents = new Set([...graph.keys()]);
  for (const agent of allAgents) {
    dfs([agent], new Set([agent]));
  }

  return cycles.slice(0, 10);
}

export async function analyzeEscalationPatterns(projectId: string): Promise<EscalationPatternReport> {
  const now = new Date();

  // Get handoff notes for tickets in this project
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);

  let handoffs: { handoffFrom: string | null; handoffTo: string | null }[] = [];

  if (ticketIds.length > 0) {
    // Get all notes with handoff data for project tickets
    const allNotes = await db
      .select({ handoffFrom: ticketNotes.handoffFrom, handoffTo: ticketNotes.handoffTo })
      .from(ticketNotes)
      .where(and(isNotNull(ticketNotes.handoffFrom), isNotNull(ticketNotes.handoffTo)));

    handoffs = allNotes.filter(n => n.handoffFrom && n.handoffTo);
  }

  if (handoffs.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      chains: [],
      hotspots: [],
      circularPatterns: [],
      totalEscalations: 0,
      avgChainLength: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Count chains
  const chainMap = new Map<string, number>();
  const agentEscalationCount = new Map<string, number>();

  for (const h of handoffs) {
    const key = `${h.handoffFrom}→${h.handoffTo}`;
    chainMap.set(key, (chainMap.get(key) || 0) + 1);
    agentEscalationCount.set(h.handoffFrom!, (agentEscalationCount.get(h.handoffFrom!) || 0) + 1);
    agentEscalationCount.set(h.handoffTo!, (agentEscalationCount.get(h.handoffTo!) || 0) + 1);
  }

  const totalEscalations = handoffs.length;

  const chains: EscalationChain[] = [...chainMap.entries()]
    .map(([key, count]) => {
      const [fromAgent, toAgent] = key.split('→');
      return { fromAgent, toAgent, count };
    })
    .sort((a, b) => b.count - a.count);

  const hotspots: EscalationHotspot[] = [...agentEscalationCount.entries()]
    .map(([agentPersona, escalationCount]) => {
      const pct = escalationCount / totalEscalations;
      let severity: 'critical' | 'high' | 'moderate' | 'low';
      if (pct >= 0.6) severity = 'critical';
      else if (pct >= 0.4) severity = 'high';
      else if (pct >= 0.2) severity = 'moderate';
      else severity = 'low';
      return { agentPersona, escalationCount, severity };
    })
    .sort((a, b) => b.escalationCount - a.escalationCount);

  const circularPatterns = detectCycles(chains);
  const avgChainLength = chains.length > 0
    ? Math.round((chains.reduce((s, c) => s + c.count, 0) / chains.length) * 10) / 10
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify({ totalEscalations, topChains: chains.slice(0, 3), hotspots: hotspots.slice(0, 3) });
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent escalation patterns. Give 2-sentence summary and 2-3 recommendations. Output JSON: {aiSummary: string, aiRecommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string; aiRecommendations: string[] };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
    if (Array.isArray(parsed.aiRecommendations) && parsed.aiRecommendations.length > 0) aiRecommendations = parsed.aiRecommendations;
  } catch (e) {
    console.warn('Agent escalation pattern AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    chains,
    hotspots,
    circularPatterns,
    totalEscalations,
    avgChainLength,
    aiSummary,
    aiRecommendations,
  };
}
