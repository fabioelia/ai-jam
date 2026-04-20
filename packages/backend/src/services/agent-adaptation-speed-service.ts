import { db } from '../db/connection.js';
import { tickets, agentSessions, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentAdaptationMetrics {
  agentId: string;
  agentName: string;
  totalHandoffs: number;
  feedbackIncorporationRate: number;
  avgIterationsToSuccess: number;
  requirementChangeCount: number;
  adaptationScore: number;
  adaptationTier: 'rapid' | 'responsive' | 'gradual' | 'resistant';
}

export interface AgentAdaptationSpeedReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdaptationScore: number;
    fastestAdapter: string;
    slowestAdapter: string;
    rapidAdapters: number;
  };
  agents: AgentAdaptationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeAdaptationScore(agent: {
  feedbackIncorporationRate: number;
  avgIterationsToSuccess: number;
  requirementChangeCount: number;
}): number {
  let score = agent.feedbackIncorporationRate * 0.5;
  const iterationBonus = Math.max(0, 20 - agent.avgIterationsToSuccess * 4);
  score += iterationBonus;
  if (agent.requirementChangeCount >= 5) score += 10;
  else if (agent.requirementChangeCount >= 2) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeAdaptationTier(
  score: number,
): AgentAdaptationMetrics['adaptationTier'] {
  if (score >= 75) return 'rapid';
  if (score >= 55) return 'responsive';
  if (score >= 35) return 'gradual';
  return 'resistant';
}

type SessionRow = {
  id: string;
  ticketId: string | null;
  personaType: string;
  status: string;
  startedAt: Date | null;
};

type NoteRow = {
  ticketId: string | null;
  handoffFrom: string | null;
  handoffTo: string | null;
  content: string | null;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
};

export function buildAdaptationMetrics(
  sessions: SessionRow[],
  notes: NoteRow[],
  projectTickets: TicketRow[],
): AgentAdaptationMetrics[] {
  const personaSet = new Set<string>();
  for (const s of sessions) personaSet.add(s.personaType);

  const metrics: AgentAdaptationMetrics[] = [];

  for (const persona of personaSet) {
    const personaSessions = sessions.filter((s) => s.personaType === persona);

    // feedbackIncorporationRate: completed sessions that followed a failed session
    const sortedSessions = [...personaSessions].sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return aTime - bTime;
    });

    let feedbackCompletions = 0;
    let failedCount = 0;
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      if (sortedSessions[i].status === 'failed') {
        failedCount++;
        if (sortedSessions[i + 1].status === 'completed') {
          feedbackCompletions++;
        }
      }
    }
    const feedbackIncorporationRate = failedCount > 0 ? (feedbackCompletions / failedCount) * 100 : 50;

    // avgIterationsToSuccess: average sessions per ticket for this persona's tickets
    const ticketIds = [...new Set(personaSessions.map((s) => s.ticketId))];
    let totalIterations = 0;
    let ticketCount = 0;
    for (const ticketId of ticketIds) {
      const ticketSessions = personaSessions.filter((s) => s.ticketId === ticketId);
      if (ticketSessions.length > 0) {
        totalIterations += ticketSessions.length;
        ticketCount++;
      }
    }
    const avgIterationsToSuccess = ticketCount > 0 ? totalIterations / ticketCount : 1;

    // requirementChangeCount: tickets that were in_progress where agent had failed sessions (proxy for changes)
    const personaTickets = projectTickets.filter((t) => t.assignedPersona === persona);
    const requirementChangeCount = personaTickets.filter((t) => {
      const ticketSessions = personaSessions.filter((s) => s.ticketId === t.id);
      return ticketSessions.some((s) => s.status === 'failed');
    }).length;

    // totalHandoffs
    const totalHandoffs = notes.filter((n) => n.handoffFrom === persona || n.handoffTo === persona).length;

    const adaptationScore = computeAdaptationScore({
      feedbackIncorporationRate,
      avgIterationsToSuccess,
      requirementChangeCount,
    });

    const adaptationTier = computeAdaptationTier(adaptationScore);

    metrics.push({
      agentId: persona,
      agentName: persona,
      totalHandoffs,
      feedbackIncorporationRate: Math.round(feedbackIncorporationRate * 10) / 10,
      avgIterationsToSuccess: Math.round(avgIterationsToSuccess * 10) / 10,
      requirementChangeCount,
      adaptationScore,
      adaptationTier,
    });
  }

  metrics.sort((a, b) => b.adaptationScore - a.adaptationScore);
  return metrics;
}

export function generateAdaptationInsights(metrics: AgentAdaptationMetrics[]): string[] {
  const insights: string[] = [];

  if (metrics.length === 0) {
    insights.push('No agent activity found for this project.');
    return insights;
  }

  const rapid = metrics.filter((m) => m.adaptationTier === 'rapid');
  const resistant = metrics.filter((m) => m.adaptationTier === 'resistant');

  if (rapid.length > 0) {
    insights.push(`${rapid.length} agent(s) show rapid adaptation capability: ${rapid.map((m) => m.agentName).join(', ')}.`);
  }

  if (resistant.length > 0) {
    insights.push(`${resistant.length} agent(s) are slow to adapt and may need process support: ${resistant.map((m) => m.agentName).join(', ')}.`);
  }

  const avgFeedback = metrics.reduce((s, m) => s + m.feedbackIncorporationRate, 0) / metrics.length;
  insights.push(`Average feedback incorporation rate across agents is ${Math.round(avgFeedback)}%.`);

  const highIter = metrics.filter((m) => m.avgIterationsToSuccess > 3);
  if (highIter.length > 0) {
    insights.push(`${highIter.length} agent(s) require more than 3 iterations on average to complete tasks, indicating adaptation challenges.`);
  }

  return insights;
}

export function generateAdaptationRecommendations(metrics: AgentAdaptationMetrics[]): string[] {
  const recommendations: string[] = [];

  const resistant = metrics.filter((m) => m.adaptationTier === 'resistant');
  if (resistant.length > 0) {
    recommendations.push('Provide additional context and structured feedback to resistant adapters to help them adjust faster.');
  }

  const highIter = metrics.filter((m) => m.avgIterationsToSuccess > 3);
  if (highIter.length > 0) {
    recommendations.push('Review task scoping for agents with high iteration counts — clearer initial requirements reduce rework cycles.');
  }

  recommendations.push('Implement post-failure review processes to ensure agents incorporate lessons learned into subsequent sessions.');

  return recommendations;
}

export async function analyzeAgentAdaptationSpeed(
  projectId: string,
): Promise<AgentAdaptationSpeedReport> {
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  let allSessions: SessionRow[] = [];
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));

    allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        content: ticketNotes.content,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgAdaptationScore: 0,
        fastestAdapter: '',
        slowestAdapter: '',
        rapidAdapters: 0,
      },
      agents: [],
      insights: ['No agent sessions found for this project.'],
      recommendations: ['Ensure agents are actively working on tickets to generate adaptation data.'],
    };
  }

  const agents = buildAdaptationMetrics(allSessions, allNotes, projectTickets);

  const avgAdaptationScore =
    agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.adaptationScore, 0) / agents.length)
      : 0;
  const fastestAdapter = agents.length > 0 ? agents[0].agentName : '';
  const slowestAdapter = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const rapidAdapters = agents.filter((a) => a.adaptationScore >= 75).length;

  const insights = generateAdaptationInsights(agents);
  const recommendations = generateAdaptationRecommendations(agents);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgAdaptationScore,
      fastestAdapter,
      slowestAdapter,
      rapidAdapters,
    },
    agents,
    insights,
    recommendations,
  };
}
