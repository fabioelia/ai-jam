import { db } from '../db/connection.js';
import { ticketNotes, tickets } from '../db/schema.js';
import { eq, isNotNull, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface HandoffIssue {
  category: 'missing-context' | 'vague-instructions' | 'no-acceptance-criteria' | 'missing-artifacts' | 'unclear-scope';
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface HandoffQualityScore {
  handoffId: string;
  ticketId: string;
  ticketTitle: string;
  fromAgent: string;
  toAgent: string;
  score: number;
  grade: 'exemplary' | 'proficient' | 'adequate' | 'deficient';
  qualityTier: 'exemplary' | 'proficient' | 'adequate' | 'deficient';
  perHandoffDetails: { quality: number; completeness: number };
  issues: HandoffIssue[];
  suggestions: string[];
  analyzedAt: string;
}

export interface HandoffQualityReport {
  projectId: string;
  totalHandoffs: number;
  averageScore: number;
  excellentCount: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  handoffs: HandoffQualityScore[];
  topIssues: { category: string; count: number }[];
  analyzedAt: string;
}

export function scoreHandoff(content: string): { score: number; issues: HandoffIssue[] } {
  let score = 100;
  const issues: HandoffIssue[] = [];

  if (!content || content.trim().length === 0) {
    score -= 40;
    issues.push({ category: 'missing-context', severity: 'high', description: 'No notes or context provided' });
  } else {
    if (content.trim().length < 50) {
      score -= 20;
      issues.push({ category: 'missing-context', severity: 'high', description: 'Notes too brief (< 50 chars)' });
    }

    const lower = content.toLowerCase();

    if (!/accept|criteria|ac\d|done when|definition of done/.test(lower)) {
      score -= 15;
      issues.push({ category: 'no-acceptance-criteria', severity: 'medium', description: 'No mention of acceptance criteria' });
    }

    if (!/next step|todo|should|must|need to|implement|fix|update/.test(lower)) {
      score -= 15;
      issues.push({ category: 'vague-instructions', severity: 'medium', description: 'No mention of next steps' });
    }

    if (!/\/|\.ts|\.tsx|\.js|\.py|src\/|packages\/|file|path|commit/.test(lower)) {
      score -= 10;
      issues.push({ category: 'missing-artifacts', severity: 'low', description: 'No mention of relevant files or paths' });
    }

    if (/^please do this|^please help|^can you|^just do/.test(lower.trim())) {
      score -= 10;
      issues.push({ category: 'unclear-scope', severity: 'low', description: 'Vague opener detected' });
    }
  }

  return { score: Math.max(0, score), issues };
}

export function gradeFromScore(score: number): HandoffQualityScore['grade'] {
  if (score >= 80) return 'exemplary';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'adequate';
  return 'deficient';
}

export function computePerHandoffDetails(content: string): { quality: number; completeness: number } {
  const lower = content ? content.toLowerCase() : '';
  let quality = 100;
  let completeness = 100;

  if (!content || content.trim().length === 0) {
    return { quality: 0, completeness: 0 };
  }

  // quality: based on instructions clarity
  if (!/next step|todo|should|must|need to|implement|fix|update/.test(lower)) quality -= 30;
  if (!/accept|criteria|ac\d|done when|definition of done/.test(lower)) quality -= 20;
  if (/^please do this|^please help|^can you|^just do/.test(lower.trim())) quality -= 15;

  // completeness: based on context presence
  if (content.trim().length < 50) completeness -= 40;
  if (!/\/|\.ts|\.tsx|\.js|\.py|src\/|packages\/|file|path|commit/.test(lower)) completeness -= 20;
  if (content.trim().length < 200) completeness -= 10;

  return {
    quality: Math.max(0, quality),
    completeness: Math.max(0, completeness),
  };
}

function suggestionsFromIssues(issues: HandoffIssue[]): string[] {
  return issues.map((issue) => {
    switch (issue.category) {
      case 'missing-context': return 'Add 2-3 sentences explaining what was already tried';
      case 'vague-instructions': return 'Specify exact file paths and function names to modify';
      case 'no-acceptance-criteria': return 'List 3-5 testable acceptance criteria';
      case 'missing-artifacts': return 'Reference relevant commit hashes or file paths';
      case 'unclear-scope': return 'Define explicit boundaries: what\'s in scope and what\'s not';
    }
  });
}

async function generateAiSuggestion(
  fromAgent: string,
  toAgent: string,
  ticketTitle: string,
  content: string,
  issues: HandoffIssue[],
): Promise<string | null> {
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const issueList = issues.map((i) => i.description).join(', ');
    const prompt = `Agent handoff from "${fromAgent}" to "${toAgent}" for ticket "${ticketTitle}". Issues: ${issueList}. Current notes: "${content.slice(0, 300)}". Give one specific improvement suggestion in 1-2 sentences.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return text || null;
  } catch {
    return null;
  }
}

export async function analyzeHandoffQuality(projectId: string): Promise<HandoffQualityReport> {
  const rows = await db
    .select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      ticketTitle: tickets.title,
      content: ticketNotes.content,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
    })
    .from(ticketNotes)
    .innerJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId))
    .orderBy(desc(ticketNotes.createdAt))
    .limit(20);

  const handoffRows = rows.filter((r) => r.handoffFrom != null);

  const now = new Date().toISOString();
  const handoffs: HandoffQualityScore[] = [];

  for (const row of handoffRows) {
    const { score, issues } = scoreHandoff(row.content);
    const grade = gradeFromScore(score);
    const baseSuggestions = suggestionsFromIssues(issues);
    const perHandoffDetails = computePerHandoffDetails(row.content);

    let suggestions = baseSuggestions;
    if (grade === 'adequate' || grade === 'deficient') {
      const aiSuggestion = await generateAiSuggestion(
        row.handoffFrom!,
        row.handoffTo ?? 'next agent',
        row.ticketTitle,
        row.content,
        issues,
      );
      if (aiSuggestion) suggestions = [aiSuggestion, ...baseSuggestions];
    }

    handoffs.push({
      handoffId: row.id,
      ticketId: row.ticketId,
      ticketTitle: row.ticketTitle,
      fromAgent: row.handoffFrom!,
      toAgent: row.handoffTo ?? 'unknown',
      score,
      grade,
      qualityTier: grade,
      perHandoffDetails,
      issues,
      suggestions,
      analyzedAt: now,
    });
  }

  const gradeOrder: Record<string, number> = { deficient: 0, adequate: 1, proficient: 2, exemplary: 3 };
  handoffs.sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);

  const totalHandoffs = handoffs.length;
  const averageScore = totalHandoffs > 0
    ? Math.round(handoffs.reduce((sum, h) => sum + h.score, 0) / totalHandoffs)
    : 0;

  const excellentCount = handoffs.filter((h) => h.grade === 'exemplary').length;
  const goodCount = handoffs.filter((h) => h.grade === 'proficient').length;
  const needsImprovementCount = handoffs.filter((h) => h.grade === 'adequate').length;
  const poorCount = handoffs.filter((h) => h.grade === 'deficient').length;

  const issueCounts: Record<string, number> = {};
  for (const h of handoffs) {
    for (const issue of h.issues) {
      issueCounts[issue.category] = (issueCounts[issue.category] ?? 0) + 1;
    }
  }
  const topIssues = Object.entries(issueCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    projectId,
    totalHandoffs,
    averageScore,
    excellentCount,
    goodCount,
    needsImprovementCount,
    poorCount,
    handoffs,
    topIssues,
    analyzedAt: now,
  };
}
