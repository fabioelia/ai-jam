import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextScore {
  agentType: string;
  ticketsHandled: number;
  midFlowPickups: number;
  escalationRate: number;
  contextRetentionScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeExplanation: string;
}

export interface ContextRetentionReport {
  projectId: string;
  totalTicketsAnalyzed: number;
  avgRetentionScore: number;
  topPerformer: string | null;
  needsAttention: string[];
  agentScores: AgentContextScore[];
  aiRecommendation: string;
  analyzedAt: string;
}

export const FALLBACK_RECOMMENDATION =
  'Improve agent context handoffs by including richer ticket state documentation.';

export function computeGrade(score: number): AgentContextScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function computeRetentionScore(midFlowPickups: number, escalationRate: number): number {
  return Math.max(0, Math.min(100, 100 - midFlowPickups * 10 - escalationRate * 50));
}

export function computeGradeExplanation(
  grade: AgentContextScore['grade'],
  agentType: string,
  score: number,
): string {
  switch (grade) {
    case 'A':
      return `${agentType} excels at context retention (score: ${score.toFixed(0)}) — minimal mid-flow disruptions and low escalation rate.`;
    case 'B':
      return `${agentType} has good context retention (score: ${score.toFixed(0)}) — occasional pickups but generally reliable.`;
    case 'C':
      return `${agentType} has moderate context retention (score: ${score.toFixed(0)}) — some mid-flow disruptions impacting continuity.`;
    case 'D':
      return `${agentType} has poor context retention (score: ${score.toFixed(0)}) — frequent escalations or mid-flow pickups detected.`;
    default:
      return `${agentType} has critical context retention issues (score: ${score.toFixed(0)}) — high disruption and escalation patterns.`;
  }
}

export interface TicketRecord {
  id: string;
  assignedPersona: string | null;
}

export interface HandoffRecord {
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
}

export function computeAgentScores(
  projectTickets: TicketRecord[],
  handoffNotes: HandoffRecord[],
): AgentContextScore[] {
  const validHandoffs = handoffNotes.filter((n) => n.handoffFrom != null);

  // Count tickets per agent
  const ticketsByAgent = new Map<string, number>();
  for (const t of projectTickets) {
    if (t.assignedPersona) {
      ticketsByAgent.set(t.assignedPersona, (ticketsByAgent.get(t.assignedPersona) ?? 0) + 1);
    }
  }

  if (ticketsByAgent.size === 0) return [];

  // midFlowPickups: handoffs WHERE handoffTo = agentType
  const midFlowByAgent = new Map<string, number>();
  for (const n of validHandoffs) {
    if (n.handoffTo) {
      midFlowByAgent.set(n.handoffTo, (midFlowByAgent.get(n.handoffTo) ?? 0) + 1);
    }
  }

  // escalations FROM agent: handoffs WHERE handoffFrom = agentType
  const escalationsByAgent = new Map<string, number>();
  for (const n of validHandoffs) {
    if (n.handoffFrom) {
      escalationsByAgent.set(n.handoffFrom, (escalationsByAgent.get(n.handoffFrom) ?? 0) + 1);
    }
  }

  const scores: AgentContextScore[] = [];
  for (const [agentType, ticketsHandled] of ticketsByAgent.entries()) {
    const midFlowPickups = midFlowByAgent.get(agentType) ?? 0;
    const escalationsFromAgent = escalationsByAgent.get(agentType) ?? 0;
    const escalationRate = ticketsHandled > 0 ? escalationsFromAgent / ticketsHandled : 0;
    const contextRetentionScore = computeRetentionScore(midFlowPickups, escalationRate);
    const grade = computeGrade(contextRetentionScore);
    scores.push({
      agentType,
      ticketsHandled,
      midFlowPickups,
      escalationRate,
      contextRetentionScore,
      grade,
      gradeExplanation: computeGradeExplanation(grade, agentType, contextRetentionScore),
    });
  }

  scores.sort((a, b) => b.contextRetentionScore - a.contextRetentionScore);
  return scores;
}

export async function analyzeContextRetention(projectId: string): Promise<ContextRetentionReport> {
  const projectTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let handoffNotes: HandoffRecord[] = [];

  if (ticketIds.length > 0) {
    const allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
      })
      .from(ticketNotes)
      .where(isNotNull(ticketNotes.handoffFrom));

    const ticketIdSet = new Set(ticketIds);
    handoffNotes = allNotes.filter((n) => ticketIdSet.has(n.ticketId));
  }

  const agentScores = computeAgentScores(projectTickets, handoffNotes);

  const totalTicketsAnalyzed = projectTickets.filter((t) => t.assignedPersona != null).length;
  const avgRetentionScore =
    agentScores.length > 0
      ? agentScores.reduce((sum, s) => sum + s.contextRetentionScore, 0) / agentScores.length
      : 0;
  const topPerformer = agentScores.length > 0 ? agentScores[0].agentType : null;
  const needsAttention = agentScores
    .filter((s) => s.grade === 'D' || s.grade === 'F')
    .map((s) => s.agentType);

  let aiRecommendation = FALLBACK_RECOMMENDATION;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentScores
      .map(
        (s) =>
          `Agent: ${s.agentType}, Score: ${s.contextRetentionScore.toFixed(0)}, Grade: ${s.grade}, MidFlowPickups: ${s.midFlowPickups}, EscalationRate: ${(s.escalationRate * 100).toFixed(0)}%`,
      )
      .join('\n');

    const prompt = `Analyze this agent context retention data and write a single paragraph recommendation about improving context retention across agents. Be concise and actionable.\n\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) aiRecommendation = content;
  } catch (e) {
    console.warn('Agent context retention AI recommendation failed, using fallback:', e);
  }

  return {
    projectId,
    totalTicketsAnalyzed,
    avgRetentionScore,
    topPerformer,
    needsAttention,
    agentScores,
    aiRecommendation,
    analyzedAt: new Date().toISOString(),
  };
}
