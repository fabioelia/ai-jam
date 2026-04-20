import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextRetentionProfile {
  personaId: string;
  avgContextUtilizationRate: number;
  contextLossCount: number;
  redundantWorkCount: number;
  avgNoteReadDepth: number;
  retentionScore: number;
  retentionCategory: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ContextRetentionReport {
  agents: AgentContextRetentionProfile[];
  avgRetentionScore: number;
  bestRetainer: string | null;
  worstRetainer: string | null;
  systemContextLossRate: number;
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
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = { id: string; assignedPersona: string | null };

function keywordOverlap(priorContent: string, agentNote: string): number {
  const keywords = priorContent.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  if (keywords.length === 0) return 0;
  const agentWords = new Set(agentNote.toLowerCase().split(/\s+/));
  const matched = keywords.filter(w => agentWords.has(w)).length;
  return matched / keywords.length;
}

function isDuplicate(prior: string, agentNote: string): boolean {
  const priorWords = new Set(prior.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (priorWords.size === 0) return false;
  const agentWords = agentNote.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (agentWords.length === 0) return false;
  const overlap = agentWords.filter(w => priorWords.has(w)).length;
  return overlap / agentWords.length > 0.6;
}

export function retentionCategory(score: number): AgentContextRetentionProfile['retentionCategory'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function computeRetentionScore(
  utilizationRate: number,
  lossRate: number,
  redundancyRate: number,
): number {
  return Math.max(0, Math.min(100,
    utilizationRate * 50 + (1 - lossRate) * 30 + (1 - redundancyRate) * 20,
  ));
}

export function buildProfiles(notes: NoteRow[]): {
  profiles: AgentContextRetentionProfile[];
  totalHandoffs: number;
  totalLosses: number;
} {
  // Group notes by ticket, sorted by createdAt
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesByTicket.get(n.ticketId) ?? [];
    list.push(n);
    notesByTicket.set(n.ticketId, list);
  }
  for (const list of notesByTicket.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Find all handoff events
  interface HandoffEvent {
    ticketId: string;
    handoffTo: string;
    priorNotes: NoteRow[];
    handoffIndex: number;
  }
  const handoffEvents: HandoffEvent[] = [];
  for (const [ticketId, ticketNoteList] of notesByTicket.entries()) {
    for (let i = 0; i < ticketNoteList.length; i++) {
      const n = ticketNoteList[i];
      if (n.handoffTo) {
        handoffEvents.push({
          ticketId,
          handoffTo: n.handoffTo,
          priorNotes: ticketNoteList.slice(0, i + 1),
          handoffIndex: i,
        });
      }
    }
  }

  // Per-agent stats
  interface AgentStats {
    handoffsReceived: number;
    utilizationSum: number;
    contextLossCount: number;
    redundantWorkCount: number;
    noteReadDepthSum: number;
  }
  const agentStats = new Map<string, AgentStats>();

  const getStats = (agentId: string): AgentStats => {
    if (!agentStats.has(agentId)) {
      agentStats.set(agentId, {
        handoffsReceived: 0,
        utilizationSum: 0,
        contextLossCount: 0,
        redundantWorkCount: 0,
        noteReadDepthSum: 0,
      });
    }
    return agentStats.get(agentId)!;
  };

  let totalLosses = 0;
  const handoffCountByTicketAgent = new Map<string, boolean>();

  for (const evt of handoffEvents) {
    const agent = evt.handoffTo;
    const stats = getStats(agent);
    stats.handoffsReceived++;

    // Prior notes content (combined)
    const priorContent = evt.priorNotes.map(n => n.content).join(' ');
    const noteReadDepth = evt.priorNotes.length;
    stats.noteReadDepthSum += noteReadDepth;

    // Find agent's first note after this handoff
    const ticketNoteList = notesByTicket.get(evt.ticketId) ?? [];
    const agentFirstNote = ticketNoteList
      .slice(evt.handoffIndex + 1)
      .find(n => n.authorId === agent || n.authorId.toLowerCase() === agent.toLowerCase());

    if (agentFirstNote) {
      // Utilization: keyword overlap with prior notes
      const overlap = keywordOverlap(priorContent, agentFirstNote.content);
      stats.utilizationSum += overlap;

      // Context loss: agent first note duplicates prior note
      const isLoss = evt.priorNotes.some(p => isDuplicate(p.content, agentFirstNote.content));
      if (isLoss) {
        stats.contextLossCount++;
        totalLosses++;
      }
    } else {
      // No response note — counts as no utilization
      stats.utilizationSum += 0;
    }

    // Redundant work: this ticket+agent was already handed off before (re-handoff = backward regression)
    const key = `${evt.ticketId}:${agent}`;
    if (handoffCountByTicketAgent.has(key)) {
      stats.redundantWorkCount++;
    } else {
      handoffCountByTicketAgent.set(key, true);
    }
  }

  const profiles: AgentContextRetentionProfile[] = [];
  for (const [personaId, stats] of agentStats.entries()) {
    const h = stats.handoffsReceived;
    const avgContextUtilizationRate = h > 0 ? stats.utilizationSum / h : 0;
    const lossRate = h > 0 ? stats.contextLossCount / h : 0;
    const redundancyRate = h > 0 ? stats.redundantWorkCount / h : 0;
    const avgNoteReadDepth = h > 0 ? stats.noteReadDepthSum / h : 0;
    const score = computeRetentionScore(avgContextUtilizationRate, lossRate, redundancyRate);
    profiles.push({
      personaId,
      avgContextUtilizationRate: Math.round(avgContextUtilizationRate * 100),
      contextLossCount: stats.contextLossCount,
      redundantWorkCount: stats.redundantWorkCount,
      avgNoteReadDepth: Math.round(avgNoteReadDepth * 10) / 10,
      retentionScore: Math.round(score),
      retentionCategory: retentionCategory(score),
    });
  }

  profiles.sort((a, b) => b.retentionScore - a.retentionScore);
  return { profiles, totalHandoffs: handoffEvents.length, totalLosses };
}

export async function analyzeContextRetention(projectId: string): Promise<ContextRetentionReport> {
  const projectTickets: TicketRow[] = await db
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
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allNotes = rawNotes;
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
      .map(p =>
        `${p.personaId}: score=${p.retentionScore}, utilization=${p.avgContextUtilizationRate}%, lossCount=${p.contextLossCount}, redundant=${p.redundantWorkCount}, category=${p.retentionCategory}`,
      )
      .join('\n');

    const prompt = `Analyze this agent context retention data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall context retention health\n- recommendations: array of 2-3 actionable recommendations (for agents scoring below 60)\n\nRespond ONLY with valid JSON.`;

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
