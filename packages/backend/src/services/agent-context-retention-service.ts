import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextRetentionProfile {
  personaId: string;
  totalHandoffs: number;
  contextLossCount: number;
  redundantWorkCount: number;
  avgContextUtilizationRate: number; // 0–100
  retentionScore: number; // 0–100
  retentionTier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentContextRetentionReport {
  agents: AgentContextRetentionProfile[];
  avgRetentionScore: number;
  bestRetainer: string | null;
  worstRetainer: string | null;
  systemContextLossRate: number; // percentage
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Context retention analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Ensure agents read prior notes before acting.'];

export type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffTo: string | null;
  handoffFrom: string | null;
  createdAt: Date;
};

export function retentionCategory(score: number): AgentContextRetentionProfile['retentionTier'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/** Weighted score: utilization*50 + (1-lossRate)*30 + (1-redundancyRate)*20, clamped 0-100 */
export function computeRetentionScore(
  contextUtilizationRate: number, // 0–1
  contextLossRate: number,         // 0–1
  redundancyRate: number,          // 0–1
): number {
  const raw =
    contextUtilizationRate * 50 +
    (1 - contextLossRate) * 30 +
    (1 - redundancyRate) * 20;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

/** Extract meaningful keywords (words ≥5 chars) from text */
function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [];
  return new Set(words);
}

/** Compute keyword overlap ratio: shared / prior keywords */
function keywordOverlap(priorText: string, responseText: string): number {
  const priorKw = extractKeywords(priorText);
  if (priorKw.size === 0) return 0;
  const responseKw = extractKeywords(responseText);
  let shared = 0;
  for (const kw of priorKw) {
    if (responseKw.has(kw)) shared++;
  }
  return shared / priorKw.size;
}

/** True if two texts are too similar (likely copy-paste, ≥80% word overlap) */
function isDuplicate(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0) return false;
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  return shared / wordsA.size >= 0.8;
}

export function buildProfiles(notes: NoteRow[]): {
  profiles: AgentContextRetentionProfile[];
  totalHandoffs: number;
  totalLosses: number;
} {
  // Sort notes chronologically
  const sorted = [...notes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Find all handoff events: note with handoffTo means prior author handed off to handoffTo agent
  // The "receiving" agent's first note on that ticket after the handoff is their response
  const handoffEvents: Array<{
    ticketId: string;
    fromAuthor: string;
    toAgent: string;
    priorContent: string;
    priorNoteTime: Date;
  }> = [];

  for (const note of sorted) {
    if (note.handoffTo) {
      handoffEvents.push({
        ticketId: note.ticketId,
        fromAuthor: note.authorId,
        toAgent: note.handoffTo,
        priorContent: note.content,
        priorNoteTime: note.createdAt,
      });
    }
  }

  // For each handoff, find the receiving agent's first note after the handoff
  const agentStats = new Map<
    string,
    {
      handoffs: number;
      contextLosses: number;
      redundantWork: number;
      utilizationSum: number;
      ticketsReceived: Map<string, number>; // ticketId → times received
    }
  >();

  const getAgent = (id: string) => {
    if (!agentStats.has(id)) {
      agentStats.set(id, {
        handoffs: 0,
        contextLosses: 0,
        redundantWork: 0,
        utilizationSum: 0,
        ticketsReceived: new Map(),
      });
    }
    return agentStats.get(id)!;
  };

  let totalHandoffs = 0;
  let totalLosses = 0;

  for (const evt of handoffEvents) {
    totalHandoffs++;
    const agent = getAgent(evt.toAgent);
    agent.handoffs++;

    // Track redundant work: same agent receiving same ticket more than once
    const prevCount = agent.ticketsReceived.get(evt.ticketId) ?? 0;
    agent.ticketsReceived.set(evt.ticketId, prevCount + 1);
    if (prevCount >= 1) {
      agent.redundantWork++;
    }

    // Find agent's first note on this ticket after the handoff
    const agentResponse = sorted.find(
      n =>
        n.ticketId === evt.ticketId &&
        n.authorId === evt.toAgent &&
        n.createdAt > evt.priorNoteTime,
    );

    if (agentResponse) {
      // Context loss: response is too similar to prior note (copy-paste)
      if (isDuplicate(evt.priorContent, agentResponse.content)) {
        agent.contextLosses++;
        totalLosses++;
      } else {
        // Context utilization: keyword overlap from prior note
        const overlap = keywordOverlap(evt.priorContent, agentResponse.content);
        agent.utilizationSum += overlap;
      }
    }
  }

  const profiles: AgentContextRetentionProfile[] = [];

  for (const [personaId, stats] of agentStats.entries()) {
    const handoffs = stats.handoffs;
    const contextLossRate = handoffs > 0 ? stats.contextLosses / handoffs : 0;
    const redundancyRate = handoffs > 0 ? stats.redundantWork / handoffs : 0;
    const validResponses = handoffs - stats.contextLosses;
    const avgContextUtilizationRate =
      validResponses > 0 ? (stats.utilizationSum / validResponses) * 100 : 0;
    const contextUtilizationNorm = avgContextUtilizationRate / 100;

    const retentionScore = computeRetentionScore(
      contextUtilizationNorm,
      contextLossRate,
      redundancyRate,
    );

    profiles.push({
      personaId,
      totalHandoffs: handoffs,
      contextLossCount: stats.contextLosses,
      redundantWorkCount: stats.redundantWork,
      avgContextUtilizationRate: Math.round(avgContextUtilizationRate * 10) / 10,
      retentionScore,
      retentionTier: retentionCategory(retentionScore),
    });
  }

  profiles.sort((a, b) => b.retentionScore - a.retentionScore);

  return { profiles, totalHandoffs, totalLosses };
}

export async function analyzeContextRetention(projectId: string): Promise<AgentContextRetentionReport> {
  const projectTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    const rawNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        authorId: ticketNotes.authorId,
        content: ticketNotes.content,
        handoffTo: ticketNotes.handoffTo,
        handoffFrom: ticketNotes.handoffFrom,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allNotes = rawNotes as NoteRow[];
  }

  const { profiles, totalHandoffs, totalLosses } = buildProfiles(allNotes);

  const avgRetentionScore =
    profiles.length > 0
      ? Math.round(profiles.reduce((s, p) => s + p.retentionScore, 0) / profiles.length)
      : 0;

  const bestRetainer = profiles.length > 0 ? profiles[0].personaId : null;
  const worstRetainer = profiles.length > 1 ? profiles[profiles.length - 1].personaId : null;
  const systemContextLossRate =
    totalHandoffs > 0 ? Math.round((totalLosses / totalHandoffs) * 100) : 0;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = profiles
      .map(
        p =>
          `${p.personaId}: score=${p.retentionScore}, tier=${p.retentionTier}, handoffs=${p.totalHandoffs}, contextLoss=${p.contextLossCount}, redundantWork=${p.redundantWorkCount}, utilization=${p.avgContextUtilizationRate}%`,
      )
      .join('\n');

    const prompt = `Analyze this agent context retention data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall context retention health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Context retention AI analysis failed, using fallback:', e);
  }

  return {
    agents: profiles,
    avgRetentionScore,
    bestRetainer,
    worstRetainer,
    systemContextLossRate,
    aiSummary,
    aiRecommendations,
  };
}
