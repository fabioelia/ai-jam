import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentLearningMetrics {
  personaId: string;
  totalSessions: number;
  earlySuccessRate: number;
  recentSuccessRate: number;
  velocityScore: number;
  improvementDelta: number;
  trend: 'improving' | 'stable' | 'regressing';
  sessionsToFirstSuccess: number | null;
  learningPhase: 'novice' | 'learning' | 'proficient' | 'expert';
}

export interface AgentLearningVelocityReport {
  agents: AgentLearningMetrics[];
  avgVelocityScore: number;
  fastestLearner: string | null;
  slowestLearner: string | null;
  mostRegressing: string | null;
  systemImprovementDelta: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeTrend(improvementDelta: number): AgentLearningMetrics['trend'] {
  if (improvementDelta >= 10) return 'improving';
  if (improvementDelta <= -10) return 'regressing';
  return 'stable';
}

export function computeLearningPhase(velocityScore: number): AgentLearningMetrics['learningPhase'] {
  if (velocityScore >= 75) return 'expert';
  if (velocityScore >= 50) return 'proficient';
  if (velocityScore >= 25) return 'learning';
  return 'novice';
}

export function computeVelocityScore(improvementDelta: number, recentSuccessRate: number): number {
  const deltaComponent = Math.max(0, Math.min(100, (improvementDelta + 100) / 2)) * 0.60;
  const recentComponent = recentSuccessRate * 0.40;
  return Math.min(100, Math.round(deltaComponent + recentComponent));
}

export async function analyzeAgentLearningVelocity(projectId: string): Promise<AgentLearningVelocityReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  type SessionRow = { id: string; personaType: string; status: string; createdAt: Date };
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        createdAt: agentSessions.createdAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const byPersona = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const list = byPersona.get(s.personaType) ?? [];
    list.push(s);
    byPersona.set(s.personaType, list);
  }

  const agents: AgentLearningMetrics[] = [];

  for (const [personaType, personaSessions] of byPersona) {
    const sorted = [...personaSessions].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const total = sorted.length;
    const windowSize = Math.max(1, Math.floor(total / 3));
    const earlySessions = sorted.slice(0, windowSize);
    const recentSessions = sorted.slice(Math.max(0, total - windowSize));

    const isSuccess = (s: SessionRow) => s.status === 'completed';

    const earlySuccess = earlySessions.filter(isSuccess).length;
    const recentSuccess = recentSessions.filter(isSuccess).length;

    const earlySuccessRate = (earlySuccess / Math.max(1, earlySessions.length)) * 100;
    const recentSuccessRate = (recentSuccess / Math.max(1, recentSessions.length)) * 100;
    const improvementDelta = recentSuccessRate - earlySuccessRate;
    const velocityScore = computeVelocityScore(improvementDelta, recentSuccessRate);

    const firstSuccessIdx = sorted.findIndex(isSuccess);
    const sessionsToFirstSuccess = firstSuccessIdx >= 0 ? firstSuccessIdx + 1 : null;

    agents.push({
      personaId: personaType,
      totalSessions: total,
      earlySuccessRate: Math.round(earlySuccessRate * 10) / 10,
      recentSuccessRate: Math.round(recentSuccessRate * 10) / 10,
      velocityScore,
      improvementDelta: Math.round(improvementDelta * 10) / 10,
      trend: computeTrend(improvementDelta),
      sessionsToFirstSuccess,
      learningPhase: computeLearningPhase(velocityScore),
    });
  }

  const avgVelocityScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.velocityScore, 0) / agents.length)
    : 0;

  const systemImprovementDelta = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.improvementDelta, 0) / agents.length * 10) / 10
    : 0;

  const fastestLearner = agents.length > 0
    ? agents.reduce((a, b) => a.velocityScore > b.velocityScore ? a : b).personaId
    : null;
  const slowestLearner = agents.length > 0
    ? agents.reduce((a, b) => a.velocityScore < b.velocityScore ? a : b).personaId
    : null;
  const regressingAgents = agents.filter(a => a.trend === 'regressing');
  const mostRegressing = regressingAgents.length > 0
    ? regressingAgents.reduce((a, b) => a.improvementDelta < b.improvementDelta ? a : b).personaId
    : null;

  let aiSummary = 'Agent learning velocity analysis complete.';
  let aiRecommendations: string[] = ['Focus coaching on regressing agents to reverse declining trends.'];

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    const msg = await client.messages.create({
      model: 'qwen/qwen3-6b',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `AI agent learning velocity: avgVelocity=${avgVelocityScore}, systemDelta=${systemImprovementDelta}, regressing=${mostRegressing}. Give 1-sentence summary and 2 recommendations.`,
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const lines = text.split('\n').filter(Boolean);
    if (lines.length > 0) aiSummary = lines[0];
    if (lines.length > 1) aiRecommendations = lines.slice(1, 3);
  } catch {
    // use defaults
  }

  return { agents, avgVelocityScore, fastestLearner, slowestLearner, mostRegressing, systemImprovementDelta, aiSummary, aiRecommendations };
}
