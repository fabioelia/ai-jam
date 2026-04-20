import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type GapSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface SkillGapEntry {
  label: string;
  totalTickets: number;
  completedTickets: number;
  stalledTickets: number;
  completionRate: number;
  coveredByAgents: string[];
  gapSeverity: GapSeverity;
  recommendation: string;
}

export interface SkillGapReport {
  projectId: string;
  analyzedAt: string;
  totalLabels: number;
  criticalGaps: number;
  coveredLabels: number;
  skillGaps: SkillGapEntry[];
  aiSummary: string;
}

const FALLBACK_REC = 'Assign a dedicated agent to improve coverage for this skill area.';
const FALLBACK_SUMMARY = 'Review critical skill gaps and assign specialist agents to uncovered label areas.';

function computeSeverity(
  completionRate: number,
  totalTickets: number,
  coveredByAgents: string[],
): GapSeverity {
  if (completionRate < 0.2 && totalTickets >= 3) return 'critical';
  if (completionRate < 0.4 && totalTickets >= 2) return 'high';
  if (completionRate < 0.6 && coveredByAgents.length <= 1) return 'moderate';
  return 'low';
}

const SEVERITY_ORDER: Record<GapSeverity, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

export async function analyzeSkillGaps(projectId: string): Promise<SkillGapReport> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      labels: (tickets as any).labels,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const nonCancelled = allTickets;

  // Group by label — each ticket can appear under multiple labels
  const labelMap = new Map<
    string,
    Array<{ status: string; assignedPersona: string | null; updatedAt: Date | null }>
  >();

  for (const t of nonCancelled) {
    const labels = (t.labels as string[] | null) ?? [];
    const keys = labels.length === 0 ? ['unlabeled'] : labels;
    for (const lbl of keys) {
      if (!labelMap.has(lbl)) labelMap.set(lbl, []);
      labelMap.get(lbl)!.push({
        status: t.status,
        assignedPersona: t.assignedPersona,
        updatedAt: t.updatedAt,
      });
    }
  }

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  // Build entries without AI recommendations first
  const entries: Omit<SkillGapEntry, 'recommendation'>[] = [];

  for (const [label, ts] of labelMap.entries()) {
    const totalTickets = ts.length;
    if (totalTickets === 0) continue;

    const completedTickets = ts.filter((t) => t.status === 'done').length;
    const stalledTickets = ts.filter((t) => {
      if (t.status === 'done') return false;
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      return updated ? updated < staleThreshold : false;
    }).length;

    const completionRate = completedTickets / totalTickets;

    const coveredByAgents = [
      ...new Set(
        ts
          .filter((t) => t.status === 'done' && t.assignedPersona)
          .map((t) => t.assignedPersona as string),
      ),
    ];

    const gapSeverity = computeSeverity(completionRate, totalTickets, coveredByAgents);

    entries.push({
      label,
      totalTickets,
      completedTickets,
      stalledTickets,
      completionRate: Math.round(completionRate * 1000) / 1000,
      coveredByAgents,
      gapSeverity,
    });
  }

  // Sort: critical → high → moderate → low, then totalTickets desc
  entries.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.gapSeverity] - SEVERITY_ORDER[b.gapSeverity];
    return sd !== 0 ? sd : b.totalTickets - a.totalTickets;
  });

  // AI recommendations in batches of 4
  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4);
    try {
      const desc = batch
        .map(
          (e) =>
            `Label: ${e.label}, Severity: ${e.gapSeverity}, CompletionRate: ${(e.completionRate * 100).toFixed(0)}%, TotalTickets: ${e.totalTickets}, CoveredByAgents: [${e.coveredByAgents.join(', ')}]`,
        )
        .join('\n');

      const prompt = `For each skill gap below, write exactly one sentence recommending how to close the gap (recruit specialist, retrain agent, reprioritize). Output as JSON array [{label, recommendation}].\n\n${desc}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ label: string; recommendation: string }>;
        for (const item of parsed) {
          if (item.label && item.recommendation) {
            recommendationMap.set(item.label, item.recommendation);
          }
        }
      }
    } catch (e) {
      console.warn('Skill gap batch AI failed, using fallback:', e);
    }
  }

  const skillGaps: SkillGapEntry[] = entries.map((e) => ({
    ...e,
    recommendation: recommendationMap.get(e.label) ?? FALLBACK_REC,
  }));

  const totalLabels = skillGaps.length;
  const criticalGaps = skillGaps.filter((e) => e.gapSeverity === 'critical').length;
  const coveredLabels = skillGaps.filter((e) => e.completionRate >= 0.8).length;

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = skillGaps
      .slice(0, 10)
      .map(
        (e) =>
          `${e.label}: severity=${e.gapSeverity}, rate=${(e.completionRate * 100).toFixed(0)}%, total=${e.totalTickets}, agents=[${e.coveredByAgents.join(', ')}]`,
      )
      .join('\n');

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `Summarize this team's skill gap health in 2-3 sentences: overall coverage quality, top 2 gaps to address, recommended action.\n\n${summaryData}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Skill gap summary AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalLabels,
    criticalGaps,
    coveredLabels,
    skillGaps,
    aiSummary,
  };
}
