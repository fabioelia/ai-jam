import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentPersonaAlignmentMetrics {
  personaId: string;
  alignmentScore: number;               // 0-100 composite
  primaryTaskRate: number;
  crossPersonaHandoffRate: number;
  roleViolationCount: number;
  specializationIndex: number;
  alignmentLevel: 'exemplary' | 'aligned' | 'drifting' | 'misaligned';
}

export interface PersonaAlignmentReport {
  agents: AgentPersonaAlignmentMetrics[];
  avgAlignmentScore: number;
  mostAligned: string | null;
  mostDrifted: string | null;
  systemCrossPersonaRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

// Persona keyword mapping for heuristic personaId matching
const PERSONA_KEYWORDS: Record<string, string[]> = {
  developer: ['implement', 'fix', 'build', 'code', 'bug', 'refactor', 'test'],
  dev: ['implement', 'fix', 'build', 'code', 'bug', 'refactor', 'test'],
  engineer: ['implement', 'fix', 'build', 'code', 'bug', 'refactor', 'test'],
  qa: ['verify', 'test', 'check', 'validate', 'qa', 'quality', 'pass', 'fail'],
  quality: ['verify', 'test', 'check', 'validate', 'qa', 'quality', 'pass', 'fail'],
  product: ['feature', 'spec', 'requirement', 'priority', 'backlog', 'roadmap'],
  pm: ['feature', 'spec', 'requirement', 'priority', 'backlog', 'roadmap'],
  designer: ['ui', 'ux', 'design', 'layout', 'style', 'color', 'component'],
  design: ['ui', 'ux', 'design', 'layout', 'style', 'color', 'component'],
  researcher: ['research', 'analyze', 'investigate', 'explore', 'compare', 'study'],
};

// Expected handoff pairs (bidirectional)
const EXPECTED_PAIRS: Array<[string, string]> = [
  ['developer', 'qa'],
  ['dev', 'qa'],
  ['engineer', 'qa'],
  ['product', 'developer'],
  ['product', 'dev'],
  ['product', 'engineer'],
  ['product', 'designer'],
  ['product', 'design'],
  ['pm', 'developer'],
  ['pm', 'dev'],
  ['pm', 'engineer'],
  ['pm', 'designer'],
  ['pm', 'design'],
  ['qa', 'product'],
  ['qa', 'pm'],
];

function getPersonaType(personaId: string): string {
  const lower = personaId.toLowerCase();
  for (const key of Object.keys(PERSONA_KEYWORDS)) {
    if (lower.includes(key)) return key;
  }
  return 'default';
}

function getKeywordsForPersona(personaId: string): string[] | null {
  const type = getPersonaType(personaId);
  return PERSONA_KEYWORDS[type] ?? null;
}

function textContainsKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

function isExpectedHandoff(from: string, to: string): boolean {
  const fromType = getPersonaType(from);
  const toType = getPersonaType(to);
  return EXPECTED_PAIRS.some(
    ([a, b]) => (a === fromType && b === toType) || (b === fromType && a === toType),
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function computeAlignmentLevel(score: number): AgentPersonaAlignmentMetrics['alignmentLevel'] {
  if (score >= 80) return 'exemplary';
  if (score >= 60) return 'aligned';
  if (score >= 40) return 'drifting';
  return 'misaligned';
}

export const FALLBACK_SUMMARY = 'Agent persona alignment analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Review agents with low alignment scores and ensure tasks match their designated personas.',
];

export async function analyzeAgentPersonaAlignment(projectId: string): Promise<PersonaAlignmentReport> {
  // Fetch all tickets for this project
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) {
    return {
      agents: [],
      avgAlignmentScore: 0,
      mostAligned: null,
      mostDrifted: null,
      systemCrossPersonaRate: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Fetch all ticket notes (handoffs) for the project tickets
  const ticketIds = allTickets.map((t) => t.id);

  type NoteRow = {
    id: string;
    ticketId: string;
    authorId: string;
    handoffFrom: string | null;
    handoffTo: string | null;
  };

  let allNotes: NoteRow[] = [];
  if (ticketIds.length > 0) {
    const { inArray } = await import('drizzle-orm');
    allNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        authorId: ticketNotes.authorId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));
  }

  // Group tickets by assignedPersona
  const personaTickets = new Map<string, typeof allTickets>();
  for (const ticket of allTickets) {
    const persona = ticket.assignedPersona as string | null;
    if (!persona) continue;
    if (!personaTickets.has(persona)) personaTickets.set(persona, []);
    personaTickets.get(persona)!.push(ticket);
  }

  if (personaTickets.size === 0) {
    return {
      agents: [],
      avgAlignmentScore: 0,
      mostAligned: null,
      mostDrifted: null,
      systemCrossPersonaRate: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Group handoffs by sender persona
  const personaHandoffs = new Map<string, Array<{ to: string }>>();
  for (const note of allNotes) {
    if (!note.handoffFrom || !note.handoffTo) continue;
    if (!personaHandoffs.has(note.handoffFrom)) personaHandoffs.set(note.handoffFrom, []);
    personaHandoffs.get(note.handoffFrom)!.push({ to: note.handoffTo });
  }

  // All keywords across all personas (for cross-check)
  const allPersonaKeywords: Record<string, string[]> = {};
  for (const key of Object.keys(PERSONA_KEYWORDS)) {
    allPersonaKeywords[key] = PERSONA_KEYWORDS[key];
  }

  // Compute metrics per persona
  const agentMetrics: AgentPersonaAlignmentMetrics[] = [];

  for (const [personaId, pTickets] of personaTickets.entries()) {
    const keywords = getKeywordsForPersona(personaId);
    const isDefault = keywords === null;

    // primaryTaskRate
    let primaryMatchCount = 0;
    let roleViolationCount = 0;

    for (const ticket of pTickets) {
      const text = `${ticket.title} ${ticket.description ?? ''}`;
      if (isDefault) {
        primaryMatchCount++;
      } else {
        if (textContainsKeywords(text, keywords!)) {
          primaryMatchCount++;
        } else {
          // Check for role violation: 0 persona keywords AND ≥2 keywords of a DIFFERENT persona
          let violationFound = false;
          for (const [otherType, otherKeywords] of Object.entries(allPersonaKeywords)) {
            if (getPersonaType(personaId) === otherType) continue;
            if (countKeywordMatches(text, otherKeywords) >= 2) {
              violationFound = true;
              break;
            }
          }
          if (violationFound) roleViolationCount++;
        }
      }
    }

    const primaryTaskRate = pTickets.length > 0 ? (primaryMatchCount / pTickets.length) * 100 : 100;

    // crossPersonaHandoffRate
    const handoffs = personaHandoffs.get(personaId) ?? [];
    let unexpectedHandoffs = 0;
    for (const h of handoffs) {
      if (!isExpectedHandoff(personaId, h.to)) {
        unexpectedHandoffs++;
      }
    }
    const crossPersonaHandoffRate =
      handoffs.length > 0 ? (unexpectedHandoffs / handoffs.length) * 100 : 0;

    // specializationIndex: proxy via ticket status distribution diversity
    // More concentration in fewer statuses → higher specialization
    const VALID_STATUSES = ['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done'];
    const statusCounts = new Map<string, number>();
    for (const t of pTickets) {
      const s = t.status as string;
      if (VALID_STATUSES.includes(s)) {
        statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
      }
    }
    const uniqueStatuses = statusCounts.size;
    // Fewer unique statuses used = more specialized (concentrate in fewer states)
    // Range: 1 status = 100, 6 statuses = 0
    const specializationIndex =
      uniqueStatuses === 0 ? 100 : clamp(100 - ((uniqueStatuses - 1) / 5) * 100, 0, 100);

    // alignmentScore = (primaryTaskRate*40 + (100 - crossPersonaHandoffRate)*30 + clamp(100 - roleViolationCount*10, 0, 100)*20 + specializationIndex*10) / 100
    const roleViolationComponent = clamp(100 - roleViolationCount * 10, 0, 100);
    const alignmentScore = Math.round(
      (primaryTaskRate * 40 +
        (100 - crossPersonaHandoffRate) * 30 +
        roleViolationComponent * 20 +
        specializationIndex * 10) /
        100,
    );

    agentMetrics.push({
      personaId,
      alignmentScore: clamp(alignmentScore, 0, 100),
      primaryTaskRate: Math.round(primaryTaskRate * 10) / 10,
      crossPersonaHandoffRate: Math.round(crossPersonaHandoffRate * 10) / 10,
      roleViolationCount,
      specializationIndex: Math.round(specializationIndex),
      alignmentLevel: computeAlignmentLevel(clamp(alignmentScore, 0, 100)),
    });
  }

  // Sort by alignmentScore descending
  agentMetrics.sort((a, b) => b.alignmentScore - a.alignmentScore);

  const avgAlignmentScore =
    agentMetrics.length > 0
      ? Math.round(agentMetrics.reduce((s, a) => s + a.alignmentScore, 0) / agentMetrics.length)
      : 0;

  const mostAligned = agentMetrics.length > 0 ? agentMetrics[0].personaId : null;
  const mostDrifted =
    agentMetrics.length > 0 ? agentMetrics[agentMetrics.length - 1].personaId : null;

  // systemCrossPersonaRate: all unexpected handoffs / all handoffs
  let totalHandoffs = 0;
  let totalUnexpected = 0;
  for (const note of allNotes) {
    if (!note.handoffFrom || !note.handoffTo) continue;
    totalHandoffs++;
    if (!isExpectedHandoff(note.handoffFrom, note.handoffTo)) totalUnexpected++;
  }
  const systemCrossPersonaRate =
    totalHandoffs > 0 ? Math.round((totalUnexpected / totalHandoffs) * 1000) / 10 : 0;

  // AI summary + recommendations
  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentLines = agentMetrics
      .map(
        (a) =>
          `Persona: ${a.personaId}, alignmentScore: ${a.alignmentScore}, level: ${a.alignmentLevel}, primaryTaskRate: ${a.primaryTaskRate}%, crossPersonaHandoffRate: ${a.crossPersonaHandoffRate}%, roleViolations: ${a.roleViolationCount}`,
      )
      .join('\n');

    const prompt = `You are an AI Scrum Master analyzing agent persona alignment. Given the following per-agent metrics, provide a brief summary and up to 3 actionable recommendations. Output ONLY valid JSON with keys "aiSummary" (string) and "aiRecommendations" (array of strings). No other text.

${agentLines}

System cross-persona rate: ${systemCrossPersonaRate}%`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.aiSummary === 'string') aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.aiRecommendations)) aiRecommendations = parsed.aiRecommendations;
    }
  } catch (e) {
    console.warn('Agent persona alignment AI analysis failed, using fallback:', e);
  }

  return {
    agents: agentMetrics,
    avgAlignmentScore,
    mostAligned,
    mostDrifted,
    systemCrossPersonaRate,
    aiSummary,
    aiRecommendations,
  };
}
