import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentCommunicationProfile {
  agentPersona: string;
  handoffsSent: number;
  avgMessageLength: number;
  contextRichness: number;
  clarificationRate: number;
  downstreamSuccessRate: number;
  qualityScore: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CommunicationPattern {
  pattern: string;
  frequency: number;
  impact: 'positive' | 'negative';
}

export interface CommunicationQualityReport {
  agents: AgentCommunicationProfile[];
  patterns: CommunicationPattern[];
  summary: {
    totalAgents: number;
    avgQualityScore: number;
    excellentCount: number;
    poorCount: number;
    bestCommunicator: string | null;
    worstCommunicator: string | null;
  };
  aiSummary: string;
  aiRecommendations: string[];
}

type HandoffRow = {
  id: string;
  ticketId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date | string;
  ticketStatus: string | null;
};

function assignTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

const FALLBACK_SUMMARY = (total: number, avg: number) =>
  `${total} agents analyzed. Average communication quality score: ${avg}. Detailed handoff analysis complete.`;

export async function analyzeAgentCommunicationQuality(projectId: string): Promise<CommunicationQualityReport> {
  const rows = (await db
    .select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      content: ticketNotes.content,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
      ticketStatus: tickets.status,
    })
    .from(ticketNotes)
    .leftJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(
      and(
        eq(tickets.projectId, projectId),
        or(isNotNull(ticketNotes.handoffFrom), isNotNull(ticketNotes.handoffTo)),
      ),
    )) as HandoffRow[];

  if (rows.length === 0) {
    return {
      agents: [],
      patterns: [],
      summary: {
        totalAgents: 0,
        avgQualityScore: 0,
        excellentCount: 0,
        poorCount: 0,
        bestCommunicator: null,
        worstCommunicator: null,
      },
      aiSummary: 'No handoff data available for this project.',
      aiRecommendations: [],
    };
  }

  const senderPersonas = new Set<string>();
  for (const row of rows) {
    if (row.handoffFrom) senderPersonas.add(row.handoffFrom);
  }

  // Build ticket status map from all rows
  const ticketStatusMap = new Map<string, string | null>();
  for (const row of rows) {
    if (!ticketStatusMap.has(row.ticketId)) {
      ticketStatusMap.set(row.ticketId, row.ticketStatus);
    }
  }

  const agents: AgentCommunicationProfile[] = [];

  for (const agentPersona of senderPersonas) {
    const sentHandoffs = rows.filter((r) => r.handoffFrom === agentPersona);
    const handoffsSent = sentHandoffs.length;

    const totalLength = sentHandoffs.reduce((sum, r) => sum + r.content.length, 0);
    const avgMessageLength = handoffsSent > 0 ? Math.round(totalLength / handoffsSent) : 0;

    const richCount = sentHandoffs.filter((r) => r.content.length > 100).length;
    const contextRichness = handoffsSent > 0 ? Math.round((richCount / handoffsSent) * 100) : 0;

    const receivedHandoffs = rows.filter((r) => r.handoffTo === agentPersona);
    let clarifiedCount = 0;
    for (const rh of receivedHandoffs) {
      const rhTime = new Date(rh.createdAt as string).getTime();
      const twoHrsLater = rhTime + 2 * 60 * 60 * 1000;
      const triggered = rows.some(
        (h) =>
          h.handoffFrom === agentPersona &&
          h.ticketId === rh.ticketId &&
          new Date(h.createdAt as string).getTime() > rhTime &&
          new Date(h.createdAt as string).getTime() <= twoHrsLater,
      );
      if (triggered) clarifiedCount++;
    }
    const clarificationRate =
      receivedHandoffs.length > 0 ? Math.round((clarifiedCount / receivedHandoffs.length) * 100) : 0;

    const sentTicketIds = new Set(sentHandoffs.map((r) => r.ticketId));
    let doneCount = 0;
    for (const ticketId of sentTicketIds) {
      if (ticketStatusMap.get(ticketId) === 'done') doneCount++;
    }
    const downstreamSuccessRate =
      sentTicketIds.size > 0 ? Math.round((doneCount / sentTicketIds.size) * 100) : 0;

    const raw = contextRichness * 0.4 + (100 - clarificationRate) * 0.3 + downstreamSuccessRate * 0.3;
    const qualityScore = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;

    agents.push({
      agentPersona,
      handoffsSent,
      avgMessageLength,
      contextRichness,
      clarificationRate,
      downstreamSuccessRate,
      qualityScore,
      tier: assignTier(qualityScore),
    });
  }

  agents.sort((a, b) => b.qualityScore - a.qualityScore);

  const patternDefs: Array<{
    pattern: string;
    impact: 'positive' | 'negative';
    predicate: (a: AgentCommunicationProfile) => boolean;
  }> = [
    {
      pattern: 'verbose communicators with high downstream success',
      impact: 'positive',
      predicate: (a) => a.avgMessageLength > 200 && a.downstreamSuccessRate >= 80,
    },
    {
      pattern: 'terse communicators with high clarification rate',
      impact: 'negative',
      predicate: (a) => a.avgMessageLength < 50 && a.clarificationRate >= 30,
    },
    {
      pattern: 'context-poor senders',
      impact: 'negative',
      predicate: (a) => a.contextRichness < 30,
    },
    {
      pattern: 'consistent clarification requesters',
      impact: 'negative',
      predicate: (a) => a.clarificationRate >= 40,
    },
    {
      pattern: 'high-quality reliable communicators',
      impact: 'positive',
      predicate: (a) => a.qualityScore >= 80,
    },
  ];

  const patterns: CommunicationPattern[] = [];
  for (const def of patternDefs) {
    const frequency = agents.filter(def.predicate).length;
    if (frequency >= 2) {
      patterns.push({ pattern: def.pattern, frequency, impact: def.impact });
    }
  }

  const totalAgents = agents.length;
  const avgQualityScore =
    totalAgents > 0
      ? Math.round((agents.reduce((s, a) => s + a.qualityScore, 0) / totalAgents) * 10) / 10
      : 0;
  const excellentCount = agents.filter((a) => a.tier === 'excellent').length;
  const poorCount = agents.filter((a) => a.tier === 'poor').length;
  const bestCommunicator = agents.length > 0 ? agents[0].agentPersona : null;
  const eligibleForWorst = agents.filter((a) => a.handoffsSent >= 2);
  const worstCommunicator =
    eligibleForWorst.length > 0 ? eligibleForWorst[eligibleForWorst.length - 1].agentPersona : null;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY(totalAgents, avgQualityScore);
  let aiRecommendations: string[] = [];

  try {
    const agentLines = agents
      .slice(0, 5)
      .map(
        (a) =>
          `${a.agentPersona}: qualityScore=${a.qualityScore}, tier=${a.tier}, contextRichness=${a.contextRichness}%, clarificationRate=${a.clarificationRate}%, downstreamSuccessRate=${a.downstreamSuccessRate}%`,
      )
      .join('\n');
    const prompt = `Analyze agent communication quality. Focus on: who communicates clearly, who causes confusion (high clarification rate), and how to improve handoff quality.\n\nAgents:\n${agentLines}\n\nPatterns: ${patterns.map((p) => `${p.pattern} (${p.impact})`).join(', ') || 'none detected'}\n\nRespond with JSON only: {"summary": "2-3 sentences", "recommendations": ["...", "...", "..."]}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations)) aiRecommendations = parsed.recommendations.slice(0, 5);
      } catch {
        aiSummary = text.slice(0, 500);
      }
    }
  } catch (e) {
    console.warn('Communication quality AI summary failed, using fallback:', e);
  }

  return {
    agents,
    patterns,
    summary: {
      totalAgents,
      avgQualityScore,
      excellentCount,
      poorCount,
      bestCommunicator,
      worstCommunicator,
    },
    aiSummary,
    aiRecommendations,
  };
}
