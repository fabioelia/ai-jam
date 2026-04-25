import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type EfficiencyTier = 'highly_efficient' | 'moderately_efficient' | 'low_efficiency' | 'parallel_bottleneck' | 'insufficient_data';

export interface AgentParallelTaskTrackerMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  avgConcurrentTasks: number;
  maxConcurrentTasks: number;
  soloCompletionRate: number;
  parallelCompletionRate: number;
  velocityDegradationRatio: number;
  optimalConcurrency: number;
  parallelEfficiencyScore: number;
  efficiencyTier: EfficiencyTier;
}

export interface ParallelTaskEfficiencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highEfficiencyCount: number;
    lowEfficiencyCount: number;
    optimalParallelism: number;
    avgConcurrentTasks: number;
    avgEfficiencyScore: number;
  };
  agents: AgentParallelTaskTrackerMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeParallelEfficiencyScore(
  velocityDegradationRatio: number,
  _avgConcurrentTasks: number,
  totalTickets: number
): number {
  if (totalTickets < 5) return 0;
  let score: number;
  if (velocityDegradationRatio <= 1.1) {
    score = 90 - (velocityDegradationRatio - 1.0) * 100;
  } else if (velocityDegradationRatio <= 1.5) {
    score = 80 - ((velocityDegradationRatio - 1.1) / 0.4) * 30;
  } else if (velocityDegradationRatio <= 2.0) {
    score = 50 - ((velocityDegradationRatio - 1.5) / 0.5) * 30;
  } else {
    score = Math.max(0, 20 - ((velocityDegradationRatio - 2.0) / 1.0) * 20);
  }
  return Math.round(score * 10) / 10;
}

export function getEfficiencyTier(efficiencyScore: number, totalTickets: number): EfficiencyTier {
  if (totalTickets < 5) return 'insufficient_data';
  if (efficiencyScore >= 80) return 'highly_efficient';
  if (efficiencyScore >= 55) return 'moderately_efficient';
  if (efficiencyScore >= 30) return 'low_efficiency';
  return 'parallel_bottleneck';
}

export function getEfficiencyTierLabel(tier: EfficiencyTier): string {
  switch (tier) {
    case 'highly_efficient': return 'Highly Efficient';
    case 'moderately_efficient': return 'Moderately Efficient';
    case 'low_efficiency': return 'Low Efficiency';
    case 'parallel_bottleneck': return 'Parallel Bottleneck';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatDegradationRatio(ratio: number): string {
  return ratio.toFixed(2) + 'x';
}

export function formatConcurrency(n: number): string {
  return n.toFixed(1) + ' tasks';
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Software Engineer';
}

export async function analyzeAgentParallelTaskEfficiencyTracker(projectId: string): Promise<ParallelTaskEfficiencyReport> {
  const allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const agentMap = new Map<string, typeof allTickets>();
  for (const ticket of allTickets) {
    if (!ticket.assignedPersona) continue;
    if (!agentMap.has(ticket.assignedPersona)) agentMap.set(ticket.assignedPersona, []);
    agentMap.get(ticket.assignedPersona)!.push(ticket);
  }

  const agentMetrics: AgentParallelTaskTrackerMetrics[] = [];

  for (const [agentId, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;
    if (totalTickets < 5) continue;

    const sorted = [...agentTickets].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Compute concurrent tasks at each ticket's start
    const concurrencies: number[] = [];
    for (const t of sorted) {
      const tStart = new Date(t.createdAt).getTime();
      const tEnd = new Date(t.updatedAt).getTime();
      const concurrent = sorted.filter(other => {
        const oStart = new Date(other.createdAt).getTime();
        const oEnd = new Date(other.updatedAt).getTime();
        return other !== t && oStart < tEnd && oEnd > tStart;
      }).length + 1; // +1 to include this ticket
      concurrencies.push(concurrent);
    }

    const avgConcurrentTasks = concurrencies.length > 0
      ? parseFloat((concurrencies.reduce((s, c) => s + c, 0) / concurrencies.length).toFixed(1))
      : 1;
    const maxConcurrentTasks = concurrencies.length > 0 ? Math.max(...concurrencies) : 1;

    // Compute solo vs parallel completion rates
    const soloDurations: number[] = [];
    const parallelDurations: number[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const duration = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
      if (duration <= 0) continue;
      if (concurrencies[i] === 1) {
        soloDurations.push(duration);
      } else {
        parallelDurations.push(duration);
      }
    }

    const soloCompletionRate = soloDurations.length > 0
      ? soloDurations.reduce((s, d) => s + d, 0) / soloDurations.length
      : 0;
    const parallelCompletionRate = parallelDurations.length > 0
      ? parallelDurations.reduce((s, d) => s + d, 0) / parallelDurations.length
      : soloCompletionRate;

    const velocityDegradationRatio = parseFloat(
      (parallelCompletionRate / Math.max(soloCompletionRate, 1)).toFixed(2)
    );

    // optimalConcurrency: highest concurrency where completionRate <= soloRate * 1.2
    let optimalConcurrency = 1;
    for (let c = 1; c <= maxConcurrentTasks; c++) {
      const cDurations = sorted
        .filter((_, i) => concurrencies[i] === c)
        .map(t => new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime())
        .filter(d => d > 0);
      if (cDurations.length === 0) continue;
      const avgD = cDurations.reduce((s, d) => s + d, 0) / cDurations.length;
      if (avgD <= soloCompletionRate * 1.2) optimalConcurrency = c;
    }

    const parallelEfficiencyScore = computeParallelEfficiencyScore(velocityDegradationRatio, avgConcurrentTasks, totalTickets);
    const efficiencyTier = getEfficiencyTier(parallelEfficiencyScore, totalTickets);

    agentMetrics.push({
      agentId,
      agentName: agentId,
      agentRole: agentRoleFromPersona(agentId),
      totalTickets,
      avgConcurrentTasks,
      maxConcurrentTasks,
      soloCompletionRate,
      parallelCompletionRate,
      velocityDegradationRatio,
      optimalConcurrency,
      parallelEfficiencyScore,
      efficiencyTier,
    });
  }

  const highEfficiencyCount = agentMetrics.filter(a => a.efficiencyTier === 'highly_efficient').length;
  const lowEfficiencyCount = agentMetrics.filter(a =>
    a.efficiencyTier === 'low_efficiency' || a.efficiencyTier === 'parallel_bottleneck'
  ).length;
  const optimalParallelism = agentMetrics.length > 0
    ? Math.round(agentMetrics.reduce((s, a) => s + a.optimalConcurrency, 0) / agentMetrics.length)
    : 1;
  const avgConcurrentTasks = agentMetrics.length > 0
    ? parseFloat((agentMetrics.reduce((s, a) => s + a.avgConcurrentTasks, 0) / agentMetrics.length).toFixed(1))
    : 0;
  const avgEfficiencyScore = agentMetrics.length > 0
    ? parseFloat((agentMetrics.reduce((s, a) => s + a.parallelEfficiencyScore, 0) / agentMetrics.length).toFixed(1))
    : 0;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agentMetrics.length,
      highEfficiencyCount,
      lowEfficiencyCount,
      optimalParallelism,
      avgConcurrentTasks,
      avgEfficiencyScore,
    },
    agents: agentMetrics,
    aiSummary: `Parallel task efficiency analysis complete for ${agentMetrics.length} agents.`,
    aiRecommendations: [
      'Agents with parallel_bottleneck tier should be given sequential tasks.',
      'Consider concurrency limits for low_efficiency agents.',
    ],
  };
}
