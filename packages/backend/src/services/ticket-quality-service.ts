import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface DimensionScore {
  score: number;
  label: string;
  note: string;
}

export interface TicketQualityResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    clarity: DimensionScore;
    completeness: DimensionScore;
    sizing: DimensionScore;
    specificity: DimensionScore;
    readiness: DimensionScore;
  };
  suggestions: string[];
  confidence: 'low' | 'medium' | 'high';
}

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];
const VAGUE_WORDS = ['fix', 'update', 'misc', 'various', 'stuff', 'thing', 'work'];
const CONCRETE_VERBS = ['create', 'update', 'display', 'show', 'add', 'remove', 'implement', 'build', 'render', 'fetch', 'send', 'store', 'validate', 'parse', 'filter', 'sort', 'search', 'upload', 'download', 'sync', 'export', 'import'];

function fallback(note = 'Ticket not found'): TicketQualityResult {
  return {
    overallScore: 0,
    grade: 'F',
    dimensions: {
      clarity: { score: 0, label: 'Clarity', note: '' },
      completeness: { score: 0, label: 'Completeness', note: '' },
      sizing: { score: 0, label: 'Sizing', note: '' },
      specificity: { score: 0, label: 'Specificity', note: '' },
      readiness: { score: 0, label: 'Readiness', note: '' },
    },
    suggestions: [note],
    confidence: 'low',
  };
}

function scoreClarity(title: string, desc: string | null): { score: number; note: string } {
  let score = 50;
  const parts: string[] = [];

  // Title length
  if (title.length >= 8 && title.length <= 80) {
    score += 25;
    parts.push('title length good');
  } else if (title.length < 8) {
    score -= 25;
    parts.push('title too short');
  } else {
    score -= 10;
    parts.push('title too long');
  }

  // Vague words
  const titleLower = title.toLowerCase();
  const found = VAGUE_WORDS.filter(w => titleLower.includes(w));
  if (found.length > 0) {
    score -= 25;
    parts.push(`vague word${found.length > 1 ? 's' : ''}: ${found.join(', ')}`);
  } else {
    score += 10;
  }

  // Description adds slight clarity context
  if (desc && desc.length > 0) {
    score += 10;
  } else {
    score -= 15;
    parts.push('missing description');
  }

  return { score: Math.max(0, Math.min(100, score)), note: parts.length > 0 ? parts.join('; ') : 'title is clear' };
}

function scoreCompleteness(desc: string | null, ac: string[] | null): { score: number; note: string } {
  let score = 30;
  const parts: string[] = [];

  if (desc && desc.length > 0) {
    if (desc.length >= 50) {
      score += 40;
    } else {
      score += 20;
      parts.push('description short (under 50 chars)');
    }
  } else {
    parts.push('no description');
  }

  if (ac && ac.length > 0) {
    score += 30;
  } else {
    score -= 15;
    parts.push('no acceptance criteria');
  }

  return { score: Math.max(0, Math.min(100, score)), note: parts.length > 0 ? parts.join('; ') : 'description and criteria present' };
}

function scoreSizing(storyPoints: number | null): { score: number; note: string } {
  if (storyPoints == null) {
    return { score: 0, note: 'story points not set' };
  }
  if (storyPoints === 0) {
    return { score: 25, note: 'story points set to 0' };
  }
  if (FIBONACCI.includes(storyPoints)) {
    return { score: 100, note: 'valid Fibonacci estimate' };
  }
  return { score: 50, note: 'non-Fibonacci value, consider using 1, 2, 3, 5, 8, 13, 21' };
}

function scoreSpecificity(desc: string | null): { score: number; note: string } {
  if (!desc || desc.length === 0) {
    return { score: 0, note: 'no description to check' };
  }
  let score = 30;
  const descLower = desc.toLowerCase();
  const found = CONCRETE_VERBS.filter(v => descLower.includes(v));
  if (found.length > 0) {
    score += 50;
  } else {
    return { score: 20, note: 'no concrete action verbs found' };
  }
  if (desc.length >= 50) {
    score += 20;
  }
  return { score: Math.max(0, Math.min(100, score)), note: `found ${found.length} concrete verb${found.length > 1 ? 's' : ''}: ${found.join(', ')}` };
}

function scoreReadiness(assignedPersona: string | null, priority: string, epicId: string | null): { score: number; note: string } {
  let score = 0;
  const parts: string[] = [];

  if (assignedPersona) {
    score += 40;
  } else {
    parts.push('no assigned persona');
  }

  if (priority !== 'medium') {
    score += 30;
  } else {
    parts.push('default priority (may indicate lack of intentional choice)');
  }

  if (epicId) {
    score += 30;
  } else {
    parts.push('no epic assigned');
  }

  return { score: Math.max(0, Math.min(100, score)), note: parts.length > 0 ? parts.join('; ') : 'ticket is ready' };
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function confidenceFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function fallbackSuggestions(dimensions: TicketQualityResult['dimensions']): string[] {
  const out: string[] = [];
  if (dimensions.clarity.score < 60) out.push('Improve title clarity: aim for 8-80 characters and avoid vague words.');
  if (dimensions.completeness.score < 60) out.push('Add a detailed description (50+ characters) and acceptance criteria.');
  if (dimensions.sizing.score < 60) out.push('Assign story points using Fibonacci values: 1, 2, 3, 5, 8, 13, 21.');
  if (dimensions.specificity.score < 60) out.push('Use concrete action verbs (create, update, display) to clarify expected behavior.');
  if (dimensions.readiness.score < 60) out.push('Assign a persona, set priority, and link to an epic for readiness.');
  return out.slice(0, 5);
}

export async function scoreTicketQuality(ticketId: string): Promise<TicketQualityResult> {
  const result = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (result.length === 0) {
    return fallback();
  }

  const ticket = result[0];
  const ac = Array.isArray(ticket.acceptanceCriteria) ? ticket.acceptanceCriteria as string[] : [];

  const clarity = scoreClarity(ticket.title, ticket.description);
  const completeness = scoreCompleteness(ticket.description, ac);
  const sizing = scoreSizing(ticket.storyPoints);
  const specificity = scoreSpecificity(ticket.description);
  const readiness = scoreReadiness(ticket.assignedPersona, ticket.priority, ticket.epicId);

  const overallScore = Math.round(
    clarity.score * 0.25 +
    completeness.score * 0.30 +
    sizing.score * 0.20 +
    specificity.score * 0.15 +
    readiness.score * 0.10,
  );

  const grade = gradeFromScore(overallScore);
  const confidence = confidenceFromScore(overallScore);

  const dimensions = {
    clarity: { score: clarity.score, label: 'Clarity', note: clarity.note },
    completeness: { score: completeness.score, label: 'Completeness', note: completeness.note },
    sizing: { score: sizing.score, label: 'Sizing', note: sizing.note },
    specificity: { score: specificity.score, label: 'Specificity', note: specificity.note },
    readiness: { score: readiness.score, label: 'Readiness', note: readiness.note },
  };

  // AI call for suggestions
  let suggestions: string[] = [];
  try {
    const failingDims = Object.entries(dimensions)
      .filter(([, d]) => d.score < 60)
      .map(([key, d]) => `- ${d.label} (${d.score}): ${d.note}`)
      .join('\n');

    if (failingDims.length > 0) {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const prompt = `A ticket has these quality scoring issues:\n${failingDims}\n\nProvide up to 5 concise, actionable suggestions to improve the ticket quality. Return a JSON array of strings with no markdown wrapping.`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          suggestions = parsed.filter((s: unknown) => typeof s === 'string').slice(0, 5);
        }
      }
    }
  } catch {
    // AI failed — use deterministic fallback
  }

  if (suggestions.length === 0) {
    suggestions = fallbackSuggestions(dimensions);
  }

  return {
    overallScore,
    grade,
    dimensions,
    suggestions,
    confidence,
  };
}
