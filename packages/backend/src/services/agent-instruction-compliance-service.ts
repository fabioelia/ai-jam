import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentInstructionComplianceMetrics {
  agentId: string;
  agentName: string;
  totalInstructions: number;
  followedInstructions: number;
  complianceRate: number;
  violationCount: number;
  avgViolationSeverity: 'minor' | 'moderate' | 'major' | 'critical';
  complianceScore: number;
  complianceTier: 'exemplary' | 'compliant' | 'partial' | 'defiant';
}

export interface AgentInstructionComplianceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgComplianceScore: number;
    mostCompliant: string;
    leastCompliant: string;
    exemplaryAgents: number;
  };
  agents: AgentInstructionComplianceMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeViolationSeverity(
  violationCount: number,
  totalInstructions: number,
): AgentInstructionComplianceMetrics['avgViolationSeverity'] {
  if (totalInstructions === 0) return 'minor';
  const ratio = violationCount / totalInstructions;
  if (ratio >= 0.3) return 'critical';
  if (ratio >= 0.15) return 'major';
  if (ratio >= 0.05) return 'moderate';
  return 'minor';
}

export function computeComplianceScore(
  complianceRate: number,
  violationCount: number,
  avgViolationSeverity: AgentInstructionComplianceMetrics['avgViolationSeverity'],
): number {
  let score = complianceRate;
  if (violationCount === 0) score += 10;
  if (avgViolationSeverity === 'critical') score -= 20;
  else if (avgViolationSeverity === 'major') score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeComplianceTier(
  score: number,
): AgentInstructionComplianceMetrics['complianceTier'] {
  if (score >= 90) return 'exemplary';
  if (score >= 70) return 'compliant';
  if (score >= 45) return 'partial';
  return 'defiant';
}

type SessionRow = {
  id: string;
  ticketId: string;
  personaType: string;
  status: string;
};

export function buildComplianceMetrics(
  sessions: SessionRow[],
): AgentInstructionComplianceMetrics[] {
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const metrics: AgentInstructionComplianceMetrics[] = [];

  for (const [personaType, agentSessionList] of sessionsByPersona.entries()) {
    const totalInstructions = agentSessionList.length;
    const followedInstructions = agentSessionList.filter((s) => s.status === 'completed').length;
    const complianceRate = totalInstructions > 0
      ? Math.round((followedInstructions / totalInstructions) * 100 * 10) / 10
      : 0;

    // violations = failed sessions
    const violationCount = agentSessionList.filter((s) => s.status === 'failed').length;
    const avgViolationSeverity = computeViolationSeverity(violationCount, totalInstructions);
    const complianceScore = computeComplianceScore(complianceRate, violationCount, avgViolationSeverity);
    const complianceTier = computeComplianceTier(complianceScore);

    const agentName = personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' ');

    metrics.push({
      agentId: personaType,
      agentName,
      totalInstructions,
      followedInstructions,
      complianceRate,
      violationCount,
      avgViolationSeverity,
      complianceScore,
      complianceTier,
    });
  }

  metrics.sort((a, b) => b.complianceScore - a.complianceScore);
  return metrics;
}

export async function analyzeAgentInstructionCompliance(
  projectId: string,
): Promise<AgentInstructionComplianceReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgComplianceScore: 0,
        mostCompliant: '',
        leastCompliant: '',
        exemplaryAgents: 0,
      },
      agents: [],
      aiSummary: '',
      aiRecommendations: [],
    };
  }

  const agents = buildComplianceMetrics(allSessions);

  const avgComplianceScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.complianceScore, 0) / agents.length)
    : 0;
  const mostCompliant = agents.length > 0 ? agents[0].agentName : '';
  const leastCompliant = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const exemplaryAgents = agents.filter((a) => a.complianceTier === 'exemplary').length;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgComplianceScore,
      mostCompliant,
      leastCompliant,
      exemplaryAgents,
    },
    agents,
    aiSummary: '',
    aiRecommendations: [],
  };
}
