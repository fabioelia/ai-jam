import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentWorkloadMetrics {
  personaId: string;
  totalSessions: number;
  totalTickets: number;
  workloadShare: number;
  overloadRisk: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentWorkloadDistributionReport {
  projectId: string;
  agents: AgentWorkloadMetrics[];
  totalProjectTickets: number;
  mostLoadedAgent: string | null;
  leastLoadedAgent: string | null;
  workloadGiniCoefficient: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Workload distribution analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Balance workload more evenly across agents.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
};

export type SessionRow = {
  ticketId: string | null;
  personaType: string;
};

export function computeOverloadRisk(workloadShare: number): AgentWorkloadMetrics['overloadRisk'] {
  if (workloadShare >= 60) return 'critical';
  if (workloadShare >= 40) return 'high';
  if (workloadShare >= 25) return 'moderate';
  return 'low';
}

export function computeGiniCoefficient(shares: number[]): number {
  const n = shares.length;
  if (n <= 1) return 0;

  const sorted = [...shares].sort((a, b) => a - b);
  const sum = sorted.reduce((s, x) => s + x, 0);
  if (sum === 0) return 0;

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i];
  }

  const gini = (2 * weightedSum) / (n * sum) - (n + 1) / n;
  return Math.max(0, Math.min(1, Math.round(gini * 1000) / 1000));
}

export function buildWorkloadProfiles(
  ticketRows: TicketRow[],
  sessionRows: SessionRow[],
): AgentWorkloadMetrics[] {
  const agentSet = new Set<string>();
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }
  for (const s of sessionRows) {
    agentSet.add(s.personaType);
  }

  const totalProjectTickets = ticketRows.filter((t) => t.assignedPersona !== null).length;

  const profiles: AgentWorkloadMetrics[] = [];

  for (const personaId of agentSet) {
    const totalTickets = ticketRows.filter((t) => t.assignedPersona === personaId).length;
    const totalSessions = sessionRows.filter((s) => s.personaType === personaId).length;
    const workloadShare =
      totalProjectTickets > 0 ? Math.round((totalTickets / totalProjectTickets) * 10000) / 100 : 0;

    profiles.push({
      personaId,
      totalSessions,
      totalTickets,
      workloadShare,
      overloadRisk: computeOverloadRisk(workloadShare),
    });
  }

  profiles.sort((a, b) => b.workloadShare - a.workloadShare);
  return profiles;
}

export async function analyzeAgentWorkloadDistribution(
  projectId: string,
): Promise<AgentWorkloadDistributionReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildWorkloadProfiles(projectTickets, allSessions);
  const totalProjectTickets = projectTickets.filter((t) => t.assignedPersona !== null).length;

  const mostLoadedAgent = agents.length > 0 ? agents[0].personaId : null;
  const leastLoadedAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  const workloadGiniCoefficient = computeGiniCoefficient(agents.map((a) => a.workloadShare));

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.personaId}: share=${a.workloadShare}%, tickets=${a.totalTickets}, risk=${a.overloadRisk}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent workload distribution data:\n${summary}\n\nGini coefficient: ${workloadGiniCoefficient}\n\nReturn JSON with:\n- summary: one paragraph describing workload balance\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Workload distribution AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    totalProjectTickets,
    mostLoadedAgent,
    leastLoadedAgent,
    workloadGiniCoefficient,
    aiSummary,
    aiRecommendations,
  };
}
