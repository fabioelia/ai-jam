import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentInstructionClarityMetric {
  agentId: string;
  clarityScore: number;
  totalInstructions: number;
  clearExecutions: number;
  ambiguousInterpretations: number;
  misinterpretations: number;
  clarificationRequests: number;
  clearExecutionRate: number;
  ambiguityRate: number;
  misinterpretationRate: number;
  clarificationRequestRate: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AgentInstructionClarityReport {
  agents: AgentInstructionClarityMetric[];
  summary: {
    clarityScore: number;
    totalInstructions: number;
    clearExecutionRate: number;
    ambiguityRate: number;
    misinterpretationRate: number;
    clarificationRequestRate: number;
    trend: 'improving' | 'stable' | 'declining';
    highestClarityAgent: string;
    lowestClarityAgent: string;
  };
}

export async function analyzeAgentInstructionClarityScore(projectId: string): Promise<AgentInstructionClarityReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      agents: [],
      summary: {
        clarityScore: 0,
        totalInstructions: 0,
        clearExecutionRate: 0,
        ambiguityRate: 0,
        misinterpretationRate: 0,
        clarificationRequestRate: 0,
        trend: 'stable',
        highestClarityAgent: '',
        lowestClarityAgent: '',
      },
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agents: AgentInstructionClarityMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalInstructions = sorted.length;
    const completed = sorted.filter(s => s.status === 'completed').length;
    const errors = sorted.filter(s => s.status === 'error').length;
    const running = sorted.filter(s => s.status === 'running').length;

    // Heuristics from session statuses
    const clearExecutions = completed;
    // ambiguous: running sessions (unclear completion)
    const ambiguousInterpretations = running;
    // misinterpretations: error sessions
    const misinterpretations = errors;
    // clarification requests: sessions that ended and restarted quickly (proxy: 0 for simplicity)
    const clarificationRequests = Math.max(0, totalInstructions - completed - errors - running);

    const clearExecutionRate = totalInstructions > 0 ? Math.round((clearExecutions / totalInstructions) * 10000) / 100 : 0;
    const ambiguityRate = totalInstructions > 0 ? Math.round((ambiguousInterpretations / totalInstructions) * 10000) / 100 : 0;
    const misinterpretationRate = totalInstructions > 0 ? Math.round((misinterpretations / totalInstructions) * 10000) / 100 : 0;
    const clarificationRequestRate = totalInstructions > 0 ? Math.round((clarificationRequests / totalInstructions) * 10000) / 100 : 0;

    const clarityScore = Math.round(clearExecutionRate);

    // Trend: compare first half vs second half clarity
    const mid = Math.floor(sorted.length / 2);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sorted.length >= 4) {
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);
      const firstClarity = firstHalf.filter(s => s.status === 'completed').length / firstHalf.length;
      const secondClarity = secondHalf.filter(s => s.status === 'completed').length / secondHalf.length;
      if (secondClarity - firstClarity > 0.1) trend = 'improving';
      else if (firstClarity - secondClarity > 0.1) trend = 'declining';
    }

    agents.push({
      agentId,
      clarityScore,
      totalInstructions,
      clearExecutions,
      ambiguousInterpretations,
      misinterpretations,
      clarificationRequests,
      clearExecutionRate,
      ambiguityRate,
      misinterpretationRate,
      clarificationRequestRate,
      trend,
    });
  }

  agents.sort((a, b) => b.clarityScore - a.clarityScore);

  const totalInstructions = agents.reduce((s, a) => s + a.totalInstructions, 0);
  const totalClear = agents.reduce((s, a) => s + a.clearExecutions, 0);
  const totalAmbiguous = agents.reduce((s, a) => s + a.ambiguousInterpretations, 0);
  const totalMisinterp = agents.reduce((s, a) => s + a.misinterpretations, 0);
  const totalClarReq = agents.reduce((s, a) => s + a.clarificationRequests, 0);

  const summaryClarityScore = totalInstructions > 0 ? Math.round((totalClear / totalInstructions) * 100) : 0;
  const summaryClearRate = totalInstructions > 0 ? Math.round((totalClear / totalInstructions) * 10000) / 100 : 0;
  const summaryAmbiguityRate = totalInstructions > 0 ? Math.round((totalAmbiguous / totalInstructions) * 10000) / 100 : 0;
  const summaryMisinterpRate = totalInstructions > 0 ? Math.round((totalMisinterp / totalInstructions) * 10000) / 100 : 0;
  const summaryClarReqRate = totalInstructions > 0 ? Math.round((totalClarReq / totalInstructions) * 10000) / 100 : 0;

  const improvingCount = agents.filter(a => a.trend === 'improving').length;
  const decliningCount = agents.filter(a => a.trend === 'declining').length;
  const summaryTrend: 'improving' | 'stable' | 'declining' =
    improvingCount > decliningCount ? 'improving' :
    decliningCount > improvingCount ? 'declining' : 'stable';

  return {
    agents,
    summary: {
      clarityScore: summaryClarityScore,
      totalInstructions,
      clearExecutionRate: summaryClearRate,
      ambiguityRate: summaryAmbiguityRate,
      misinterpretationRate: summaryMisinterpRate,
      clarificationRequestRate: summaryClarReqRate,
      trend: summaryTrend,
      highestClarityAgent: agents[0]?.agentId ?? '',
      lowestClarityAgent: agents[agents.length - 1]?.agentId ?? '',
    },
  };
}
