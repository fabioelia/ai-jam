import { db } from '../db/connection.js';
import { tickets, ticketNotes, agentSessions } from '../db/schema.js';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentErrorRecoveryData {
  personaId: string;
  totalErrors: number;
  recoveredErrors: number;
  errorRecoveryRate: number;
  avgRecoveryTimeHours: number;
  failedHandoffs: number;
  retryAttempts: number;
  resilienceScore: number;
  resilienceTier: 'resilient' | 'adaptive' | 'fragile' | 'critical';
}

export interface AgentErrorRecoveryReport {
  projectId: string;
  agents: AgentErrorRecoveryData[];
  mostResilientAgent: string | null;
  mostFragileAgent: string | null;
  avgProjectResilienceScore: number;
  criticalAgentCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Error recovery analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review blocked tickets and improve resolution workflows.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  blockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteRow = {
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

export type SessionRow = {
  ticketId: string | null;
  personaType: string;
  startedAt: Date | null;
};

export function computeResilienceTier(score: number): AgentErrorRecoveryData['resilienceTier'] {
  if (score >= 80) return 'resilient';
  if (score >= 60) return 'adaptive';
  if (score >= 40) return 'fragile';
  return 'critical';
}

export function computeResilienceScore(
  errorRecoveryRate: number,
  avgRecoveryTimeHours: number,
  failedHandoffs: number,
  retryAttempts: number,
): number {
  let score = errorRecoveryRate;
  if (avgRecoveryTimeHours < 2 && avgRecoveryTimeHours >= 0) score += 10;
  score -= Math.min(30, failedHandoffs * 5);
  if (retryAttempts > 0) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildRecoveryProfiles(
  ticketRows: TicketRow[],
  notes: NoteRow[],
  sessions: SessionRow[],
): AgentErrorRecoveryData[] {
  const agentSet = new Set<string>();
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }
  for (const n of notes) {
    if (n.handoffFrom) agentSet.add(n.handoffFrom);
    if (n.handoffTo) agentSet.add(n.handoffTo);
  }

  const profiles: AgentErrorRecoveryData[] = [];

  for (const personaId of agentSet) {
    // totalErrors: blocked tickets assigned to this agent
    const blockedTickets = ticketRows.filter(
      (t) => t.assignedPersona === personaId && t.blockedBy !== null,
    );
    const totalErrors = blockedTickets.length;

    // recoveredErrors: blocked tickets now done or acceptance
    const recoveredTickets = blockedTickets.filter(
      (t) => t.status === 'done' || t.status === 'acceptance',
    );
    const recoveredErrors = recoveredTickets.length;

    const errorRecoveryRate = totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 0;

    // avgRecoveryTimeHours: updatedAt - createdAt for recovered tickets
    let avgRecoveryTimeHours = 0;
    if (recoveredTickets.length > 0) {
      const totalHours = recoveredTickets.reduce((sum, t) => {
        const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3600000;
        return sum + Math.max(0, hours);
      }, 0);
      avgRecoveryTimeHours = Math.round((totalHours / recoveredTickets.length) * 100) / 100;
    }

    // failedHandoffs: handoffs from personaId with no follow-up handoffTo within 72h
    const outboundHandoffs = notes.filter((n) => n.handoffFrom === personaId);
    let failedHandoffs = 0;
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    for (const handoff of outboundHandoffs) {
      const handoffTime = handoff.createdAt.getTime();
      const hasResponse = notes.some(
        (n) =>
          n.ticketId === handoff.ticketId &&
          n.handoffTo !== null &&
          n.createdAt.getTime() > handoffTime &&
          n.createdAt.getTime() - handoffTime <= SEVENTY_TWO_HOURS,
      );
      if (!hasResponse) failedHandoffs++;
    }

    // retryAttempts: sessions for blocked tickets started within 24h of ticket creation
    const blockedTicketIds = new Set(blockedTickets.map((t) => t.id));
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const retryAttempts = sessions.filter((s) => {
      if (!s.ticketId || !blockedTicketIds.has(s.ticketId) || !s.startedAt) return false;
      const ticket = blockedTickets.find((t) => t.id === s.ticketId);
      if (!ticket) return false;
      const delta = s.startedAt.getTime() - ticket.createdAt.getTime();
      return delta >= 0 && delta <= TWENTY_FOUR_HOURS;
    }).length;

    const resilienceScore = computeResilienceScore(
      errorRecoveryRate,
      avgRecoveryTimeHours,
      failedHandoffs,
      retryAttempts,
    );

    profiles.push({
      personaId,
      totalErrors,
      recoveredErrors,
      errorRecoveryRate: Math.round(errorRecoveryRate * 100) / 100,
      avgRecoveryTimeHours,
      failedHandoffs,
      retryAttempts,
      resilienceScore,
      resilienceTier: computeResilienceTier(resilienceScore),
    });
  }

  profiles.sort((a, b) => b.resilienceScore - a.resilienceScore);
  return profiles;
}

export async function analyzeAgentErrorRecovery(projectId: string): Promise<AgentErrorRecoveryReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      blockedBy: tickets.blockedBy,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allNotes: NoteRow[] = [];
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allSessions = await db
      .select({
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        startedAt: agentSessions.startedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildRecoveryProfiles(projectTickets, allNotes, allSessions);

  const avgProjectResilienceScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.resilienceScore, 0) / agents.length)
      : 0;

  const mostResilientAgent = agents.length > 0 ? agents[0].personaId : null;
  const mostFragileAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;
  const criticalAgentCount = agents.filter((a) => a.resilienceTier === 'critical').length;

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
          `${a.personaId}: tier=${a.resilienceTier}, score=${a.resilienceScore}, recovery=${a.errorRecoveryRate.toFixed(1)}%`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent error recovery data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall resilience health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Error recovery AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    mostResilientAgent,
    mostFragileAgent,
    avgProjectResilienceScore,
    criticalAgentCount,
    aiSummary,
    aiRecommendations,
  };
}
