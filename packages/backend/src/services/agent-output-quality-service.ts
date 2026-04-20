import { db } from '../db/connection.js';
import { tickets, ticketNotes, transitionGates, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentOutputQualityAgent {
  personaId: string;
  qualityScore: number;
  acceptanceRate: number;
  reworkRate: number;
  completenessScore: number;
  formattingComplianceRate: number;
  totalOutputs: number;
  acceptedOutputs: number;
  reworkedOutputs: number;
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentOutputQualityReport {
  agents: AgentOutputQualityAgent[];
  avgQualityScore: number;
  highestQuality: string | null;
  lowestQuality: string | null;
  mostReworked: string | null;
  systemAcceptanceRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Agent output quality analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review agents with high rework rates and provide targeted feedback.'];

function qualityTier(score: number): AgentOutputQualityAgent['qualityTier'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export async function scoreAgentOutputQuality(projectId: string): Promise<AgentOutputQualityReport> {
  const allTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) {
    return {
      agents: [],
      avgQualityScore: 0,
      highestQuality: null,
      lowestQuality: null,
      mostReworked: null,
      systemAcceptanceRate: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const ticketIds = allTickets.map((t) => t.id);
  const ticketStatusMap = new Map(allTickets.map((t) => [t.id, t.status]));

  const [allNotes, allGates, allSessions] = await Promise.all([
    db
      .select({ handoffFrom: ticketNotes.handoffFrom, handoffTo: ticketNotes.handoffTo, ticketId: ticketNotes.ticketId })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds)),
    db
      .select({ ticketId: transitionGates.ticketId, result: transitionGates.result })
      .from(transitionGates)
      .where(inArray(transitionGates.ticketId, ticketIds)),
    db
      .select({ personaType: agentSessions.personaType, status: agentSessions.status, ticketId: agentSessions.ticketId })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds)),
  ]);

  // Group tickets by persona
  const personaMap = new Map<string, { assigned: string[]; done: string[] }>();
  for (const t of allTickets) {
    const p = t.assignedPersona ?? 'Unassigned';
    if (!personaMap.has(p)) personaMap.set(p, { assigned: [], done: [] });
    const entry = personaMap.get(p)!;
    entry.assigned.push(t.id);
    if (t.status === 'done') entry.done.push(t.id);
  }

  // Build rejected ticket set for rework
  const rejectedTicketIds = new Set(allGates.filter((g) => g.result === 'rejected').map((g) => g.ticketId));

  const agents: AgentOutputQualityAgent[] = [];

  for (const [persona, { assigned, done }] of personaMap.entries()) {
    if (assigned.length === 0) continue;

    const totalOutputs = assigned.length;

    // Ticket completion rate → used as completenessScore
    const completenessScore = Math.round((done.length / assigned.length) * 100);

    // Acceptance rate: outgoing handoffs accepted by downstream
    const outgoing = allNotes.filter((n) => n.handoffFrom === persona);
    const accepted = outgoing.filter((n) => {
      const status = ticketStatusMap.get(n.ticketId);
      return status != null && ['qa', 'acceptance', 'done'].includes(status);
    });
    const acceptanceRate = outgoing.length === 0
      ? 100
      : Math.round((accepted.length / outgoing.length) * 100);
    const acceptedOutputs = accepted.length;

    // Rework rate: assigned tickets with a rejected gate / total done
    const assignedSet = new Set(assigned);
    const reworkedOutputs = done.filter((id) => rejectedTicketIds.has(id) && assignedSet.has(id)).length;
    const reworkRate = done.length === 0 ? 0 : Math.round((reworkedOutputs / done.length) * 100);

    // Session success rate → used as formattingComplianceRate (proxy)
    const personaSessions = allSessions.filter((s) => s.personaType === persona && s.ticketId != null && assignedSet.has(s.ticketId!));
    const completedSessions = personaSessions.filter((s) => s.status === 'completed');
    const formattingComplianceRate = personaSessions.length === 0
      ? 100
      : Math.round((completedSessions.length / personaSessions.length) * 100);

    // Weighted quality score: completeness 35%, acceptance 30%, rework-inverted 20%, formatting 15%
    const qualityScore = Math.round(
      completenessScore * 0.35 +
      acceptanceRate * 0.30 +
      (100 - reworkRate) * 0.20 +
      formattingComplianceRate * 0.15,
    );

    agents.push({
      personaId: persona,
      qualityScore,
      acceptanceRate,
      reworkRate,
      completenessScore,
      formattingComplianceRate,
      totalOutputs,
      acceptedOutputs,
      reworkedOutputs,
      qualityTier: qualityTier(qualityScore),
    });
  }

  agents.sort((a, b) => b.qualityScore - a.qualityScore);

  const avgQualityScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.qualityScore, 0) / agents.length)
      : 0;

  const highestQuality = agents.length > 0 ? agents[0].personaId : null;
  const lowestQuality = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  // Most reworked: agent with highest reworkedOutputs
  const mostReworkedAgent = agents.reduce<AgentOutputQualityAgent | null>((prev, cur) => {
    if (!prev) return cur.reworkedOutputs > 0 ? cur : null;
    return cur.reworkedOutputs > prev.reworkedOutputs ? cur : prev;
  }, null);
  const mostReworked = mostReworkedAgent?.personaId ?? null;

  // System acceptance rate: total accepted / total outgoing across all agents
  const totalOutgoing = allNotes.filter((n) => n.handoffFrom != null).length;
  const totalAccepted = allNotes.filter((n) => {
    const status = ticketStatusMap.get(n.ticketId);
    return status != null && ['qa', 'acceptance', 'done'].includes(status);
  }).length;
  const systemAcceptanceRate = totalOutgoing === 0 ? 100 : Math.round((totalAccepted / totalOutgoing) * 100);

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
          `${a.personaId}: score=${a.qualityScore}, acceptance=${a.acceptanceRate}%, rework=${a.reworkRate}%, completeness=${a.completenessScore}%, tier=${a.qualityTier}`,
      )
      .join('\n');

    const prompt = `Analyze this agent output quality data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall output quality health\n- recommendations: array of 2-3 actionable recommendations (for agents scoring below 60)\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Output quality AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    avgQualityScore,
    highestQuality,
    lowestQuality,
    mostReworked,
    systemAcceptanceRate,
    aiSummary,
    aiRecommendations,
  };
}
