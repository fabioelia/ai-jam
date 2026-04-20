import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type QualityRating = 'excellent' | 'good' | 'needs_improvement' | 'poor';

export interface AgentDecisionQuality {
  agentPersona: string;
  totalTickets: number;
  completedTickets: number;
  regressionCount: number;
  revisionRate: number;
  qualityScore: number;
  rating: QualityRating;
  recommendation: string;
}

export interface DecisionQualityReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  poorQualityAgents: number;
  excellentAgents: number;
  avgQualityScore: number;
  agentQualities: AgentDecisionQuality[];
  aiSummary: string;
}

const FALLBACK_REC = 'Review ticket history to identify recurring quality issues and provide targeted feedback.';
const FALLBACK_SUMMARY = 'Monitor agent revision rates and invest in quality gates to reduce ticket regressions.';

const RATING_ORDER: Record<QualityRating, number> = { poor: 0, needs_improvement: 1, good: 2, excellent: 3 };

function computeRating(qualityScore: number): QualityRating {
  if (qualityScore >= 80) return 'excellent';
  if (qualityScore >= 60) return 'good';
  if (qualityScore >= 40) return 'needs_improvement';
  return 'poor';
}

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}

export async function analyzeDecisionQuality(projectId: string): Promise<DecisionQualityReport> {
  const now = new Date();
  const regressionThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const assignedTickets = allTickets.filter((t) => t.assignedPersona != null);

  if (assignedTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalAgents: 0,
      poorQualityAgents: 0,
      excellentAgents: 0,
      avgQualityScore: 0,
      agentQualities: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  // Group by agent
  const agentMap = new Map<string, Array<{ status: string; createdAt: Date | null }>>();
  for (const t of assignedTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push({ status: t.status, createdAt: t.createdAt });
  }

  type RawQuality = Omit<AgentDecisionQuality, 'recommendation'>;
  const rawQualities: RawQuality[] = [];

  for (const [agentPersona, ts] of agentMap.entries()) {
    const totalTickets = ts.length;
    const completedTickets = ts.filter((t) => t.status === 'done').length;
    // Regression heuristic: in_progress tickets created more than 48h ago (likely regressed from later stage)
    const regressionCount = ts.filter((t) => {
      if (t.status !== 'in_progress') return false;
      const created = t.createdAt ? new Date(t.createdAt) : null;
      return created ? created < regressionThreshold : false;
    }).length;

    const revisionRate = totalTickets > 0 ? regressionCount / totalTickets : 0;
    const qualityScore = Math.round(Math.max(0, 100 - revisionRate * 100) * 10) / 10;
    const rating = computeRating(qualityScore);

    rawQualities.push({ agentPersona, totalTickets, completedTickets, regressionCount, revisionRate, qualityScore, rating });
  }

  // Sort: poor → needs_improvement → good → excellent, within tier by revisionRate desc
  rawQualities.sort((a, b) => {
    const rd = RATING_ORDER[a.rating] - RATING_ORDER[b.rating];
    return rd !== 0 ? rd : b.revisionRate - a.revisionRate;
  });

  const agentsWithTickets = rawQualities.filter((q) => q.totalTickets > 0);
  const avgQualityScore =
    agentsWithTickets.length > 0
      ? Math.round((agentsWithTickets.reduce((s, q) => s + q.qualityScore, 0) / agentsWithTickets.length) * 10) / 10
      : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  // Batch AI recommendations — prioritize poor + needs_improvement
  const priority = rawQualities.filter((q) => q.rating === 'poor' || q.rating === 'needs_improvement');
  const rest = rawQualities.filter((q) => q.rating === 'good' || q.rating === 'excellent');
  const batchOrder = [...priority, ...rest];

  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < batchOrder.length; i += 4) {
    const batch = batchOrder.slice(i, i + 4);
    try {
      const desc = batch
        .map(
          (q) =>
            `Agent: ${q.agentPersona}, Rating: ${q.rating}, QualityScore: ${q.qualityScore}%, Regressions: ${q.regressionCount}/${q.totalTickets}`,
        )
        .join('\n');
      const prompt = `For each agent below, write exactly one sentence with a concrete improvement suggestion based on their quality rating. Output as JSON array [{agentPersona, recommendation}].\n\n${desc}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSONFromText(text);
      const parsed = JSON.parse(jsonStr) as Array<{ agentPersona: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.agentPersona && item.recommendation) {
          recommendationMap.set(item.agentPersona, item.recommendation);
        }
      }
    } catch (e) {
      console.warn('Decision quality batch AI failed, using fallback:', e);
    }
  }

  const agentQualities: AgentDecisionQuality[] = rawQualities.map((q) => ({
    ...q,
    recommendation: recommendationMap.get(q.agentPersona) ?? FALLBACK_REC,
  }));

  // AI summary
  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = agentQualities
      .slice(0, 10)
      .map(
        (q) =>
          `${q.agentPersona}: rating=${q.rating}, score=${q.qualityScore}%, regressions=${q.regressionCount}/${q.totalTickets}`,
      )
      .join('\n');
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize team quality health in 2-3 sentences: name the worst and best agent, describe overall quality health, recommend one team-wide action.\n\n${summaryData}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Decision quality summary AI failed, using fallback:', e);
  }

  const poorQualityAgents = agentQualities.filter((q) => q.rating === 'poor').length;
  const excellentAgents = agentQualities.filter((q) => q.rating === 'excellent').length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalAgents: agentQualities.length,
    poorQualityAgents,
    excellentAgents,
    avgQualityScore,
    agentQualities,
    aiSummary,
  };
}
