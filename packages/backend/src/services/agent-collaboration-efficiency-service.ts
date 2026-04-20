import { db } from '../db/connection.js';
import { tickets, agentSessions, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentCollaborationMetrics {
  agentId: string;
  agentName: string;
  handoffsSent: number;
  handoffsReceived: number;
  continuationRate: number;
  contextUtilizationRate: number;
  collaborationScore: number;
  collaborationTier: 'synergistic' | 'cooperative' | 'independent' | 'isolated';
}

export interface AgentCollaborationEfficiencyReport {
  projectId: string;
  generatedAt: string;
  totalHandoffs: number;
  avgCollaborationScore: number;
  topCollaborator: string;
  collaborationNetworkDensity: number;
  agentMetrics: AgentCollaborationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeCollaborationScore(
  continuationRate: number,
  contextUtilizationRate: number,
  handoffsSent: number,
  handoffsReceived: number,
): number {
  const handoffVolume = Math.min(handoffsSent + handoffsReceived, 20) / 20 * 100;
  const raw = continuationRate * 0.4 + contextUtilizationRate * 0.4 + handoffVolume * 0.2;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function computeCollaborationTier(
  score: number,
): AgentCollaborationMetrics['collaborationTier'] {
  if (score >= 80) return 'synergistic';
  if (score >= 60) return 'cooperative';
  if (score >= 40) return 'independent';
  return 'isolated';
}

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  outputSummary: string | null;
};

type NoteRow = {
  handoffFrom: string | null;
  handoffTo: string | null;
};

export function buildCollaborationMetrics(
  sessions: SessionRow[],
  notes: NoteRow[],
): AgentCollaborationMetrics[] {
  const personaSet = new Set<string>();
  for (const s of sessions) personaSet.add(s.personaType);
  for (const n of notes) {
    if (n.handoffFrom) personaSet.add(n.handoffFrom);
    if (n.handoffTo) personaSet.add(n.handoffTo);
  }

  const metrics: AgentCollaborationMetrics[] = [];

  for (const persona of personaSet) {
    const personaSessions = sessions.filter((s) => s.personaType === persona);
    const totalSessions = personaSessions.length;

    const completedSessions = personaSessions.filter((s) => s.status === 'completed').length;
    const continuationRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    const withSummary = personaSessions.filter((s) => s.outputSummary != null && s.outputSummary.trim() !== '').length;
    const contextUtilizationRate = totalSessions > 0 ? (withSummary / totalSessions) * 100 : 0;

    const handoffsSent = notes.filter((n) => n.handoffFrom === persona).length;
    const handoffsReceived = notes.filter((n) => n.handoffTo === persona).length;

    const collaborationScore = computeCollaborationScore(
      continuationRate,
      contextUtilizationRate,
      handoffsSent,
      handoffsReceived,
    );

    const collaborationTier = computeCollaborationTier(collaborationScore);

    metrics.push({
      agentId: persona,
      agentName: persona,
      handoffsSent,
      handoffsReceived,
      continuationRate: Math.round(continuationRate * 10) / 10,
      contextUtilizationRate: Math.round(contextUtilizationRate * 10) / 10,
      collaborationScore,
      collaborationTier,
    });
  }

  metrics.sort((a, b) => b.collaborationScore - a.collaborationScore);
  return metrics;
}

export function computeNetworkDensity(agentCount: number, notes: NoteRow[]): number {
  if (agentCount < 2) return 0;
  const possiblePairs = (agentCount * (agentCount - 1)) / 2;
  const actualPairs = new Set<string>();
  for (const n of notes) {
    if (n.handoffFrom && n.handoffTo) {
      const key = [n.handoffFrom, n.handoffTo].sort().join('||');
      actualPairs.add(key);
    }
  }
  return Math.min(1, Math.round((actualPairs.size / possiblePairs) * 100) / 100);
}

export function generateInsights(
  metrics: AgentCollaborationMetrics[],
  totalHandoffs: number,
): string[] {
  const insights: string[] = [];

  if (metrics.length === 0) {
    insights.push('No agent activity found for this project.');
    return insights;
  }

  const synergistic = metrics.filter((m) => m.collaborationTier === 'synergistic');
  const isolated = metrics.filter((m) => m.collaborationTier === 'isolated');

  if (synergistic.length > 0) {
    insights.push(`${synergistic.length} agent(s) operate at synergistic collaboration level: ${synergistic.map((m) => m.agentName).join(', ')}.`);
  }
  if (isolated.length > 0) {
    insights.push(`${isolated.length} agent(s) are working in isolation and may need collaboration support: ${isolated.map((m) => m.agentName).join(', ')}.`);
  }

  if (totalHandoffs === 0) {
    insights.push('No handoffs detected — agents may be working independently without coordination.');
  } else {
    insights.push(`Total of ${totalHandoffs} handoffs recorded across all agents.`);
  }

  const avgContinuation = metrics.reduce((s, m) => s + m.continuationRate, 0) / metrics.length;
  if (avgContinuation < 50) {
    insights.push('Low average continuation rate suggests incomplete task handoffs across the team.');
  } else {
    insights.push(`Team average continuation rate is ${Math.round(avgContinuation)}%, indicating healthy task follow-through.`);
  }

  return insights;
}

export function generateRecommendations(metrics: AgentCollaborationMetrics[]): string[] {
  const recommendations: string[] = [];

  const lowContext = metrics.filter((m) => m.contextUtilizationRate < 40);
  if (lowContext.length > 0) {
    recommendations.push('Improve output summaries for agents with low context utilization rates to enhance handoff quality.');
  }

  const isolated = metrics.filter((m) => m.collaborationTier === 'isolated');
  if (isolated.length > 0) {
    recommendations.push('Assign isolated agents to collaborative tasks or pair them with higher-performing collaborators.');
  }

  recommendations.push('Review handoff protocols to ensure context is effectively transferred between agent sessions.');

  return recommendations;
}

export async function analyzeAgentCollaborationEfficiency(
  projectId: string,
): Promise<AgentCollaborationEfficiencyReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  let allSessions: SessionRow[] = [];
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        outputSummary: agentSessions.outputSummary,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));

    allNotes = await db
      .select({
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));
  }

  if (allSessions.length === 0 && allNotes.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      totalHandoffs: 0,
      avgCollaborationScore: 0,
      topCollaborator: '',
      collaborationNetworkDensity: 0,
      agentMetrics: [],
      insights: ['No agent activity found for this project.'],
      recommendations: ['Ensure agents are actively working on tickets to generate collaboration data.'],
    };
  }

  const agentMetrics = buildCollaborationMetrics(allSessions, allNotes);

  const totalHandoffs = allNotes.filter((n) => n.handoffFrom && n.handoffTo).length;
  const avgCollaborationScore =
    agentMetrics.length > 0
      ? Math.round(agentMetrics.reduce((sum, m) => sum + m.collaborationScore, 0) / agentMetrics.length)
      : 0;
  const topCollaborator = agentMetrics.length > 0 ? agentMetrics[0].agentName : '';
  const collaborationNetworkDensity = computeNetworkDensity(agentMetrics.length, allNotes);

  const insights = generateInsights(agentMetrics, totalHandoffs);
  const recommendations = generateRecommendations(agentMetrics);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    totalHandoffs,
    avgCollaborationScore,
    topCollaborator,
    collaborationNetworkDensity,
    agentMetrics,
    insights,
    recommendations,
  };
}
