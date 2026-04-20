import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type SpecializationStrength = 'strong' | 'moderate' | 'generalist';

export interface AgentSpecialization {
  agentPersona: string;
  totalCompleted: number;
  topLabels: string[];
  completionRate: number;
  avgCompletionTimeMs: number;
  specializationStrength: SpecializationStrength;
  recommendation: string;
}

export interface SpecializationReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  specialistAgents: number;
  generalistAgents: number;
  agentProfiles: AgentSpecialization[];
  topLabel: string | null;
  aiSummary: string;
}

const FALLBACK_RECOMMENDATION = 'Route tickets matching agent history for best performance.';
const FALLBACK_SUMMARY =
  'Review agent specializations to optimize ticket routing. Assign label-matched tickets to strong specialists.';

function computeStrength(topLabelCount: number, totalLabeled: number): SpecializationStrength {
  if (totalLabeled === 0) return 'generalist';
  const pct = topLabelCount / totalLabeled;
  if (pct >= 0.5) return 'strong';
  if (pct >= 0.25) return 'moderate';
  return 'generalist';
}

function strengthOrder(s: SpecializationStrength): number {
  if (s === 'strong') return 0;
  if (s === 'moderate') return 1;
  return 2;
}

export async function mapAgentSpecializations(projectId: string): Promise<SpecializationReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      labels: tickets.labels,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  const agentMap = new Map<string, typeof allTickets>();
  for (const t of allTickets) {
    const persona = t.assignedPersona as string;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t);
  }

  // Label frequency across ALL completed tickets for topLabel
  const globalLabelCount = new Map<string, number>();

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const profiles: AgentSpecialization[] = [];

  // Process agents in batches of 4 for AI recommendations
  const agentEntries = [...agentMap.entries()];

  const agentData: Array<{
    agentPersona: string;
    totalCompleted: number;
    topLabels: string[];
    completionRate: number;
    avgCompletionTimeMs: number;
    specializationStrength: SpecializationStrength;
    labelCountMap: Map<string, number>;
  }> = [];

  for (const [persona, agentTickets] of agentEntries) {
    const done = agentTickets.filter((t) => t.status === 'done');
    const active = agentTickets.filter((t) => t.status === 'in_progress' || t.status === 'review');

    const totalCompleted = done.length;
    const completionRate =
      done.length + active.length === 0 ? 1.0 : done.length / (done.length + active.length);

    const avgCompletionTimeMs =
      totalCompleted === 0
        ? 0
        : done.reduce((sum, t) => {
            const created = t.createdAt ? new Date(t.createdAt).getTime() : now.getTime();
            const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : now.getTime();
            return sum + (updated - created);
          }, 0) / totalCompleted;

    // Count labels
    const labelCountMap = new Map<string, number>();
    let totalLabeled = 0;
    for (const t of done) {
      const lbls = (t.labels as string[] | null) ?? [];
      if (lbls.length === 0) {
        labelCountMap.set('unlabeled', (labelCountMap.get('unlabeled') ?? 0) + 1);
      } else {
        totalLabeled++;
        for (const lbl of lbls) {
          labelCountMap.set(lbl, (labelCountMap.get(lbl) ?? 0) + 1);
          globalLabelCount.set(lbl, (globalLabelCount.get(lbl) ?? 0) + 1);
        }
      }
    }

    const sortedLabels = [...labelCountMap.entries()]
      .filter(([k]) => k !== 'unlabeled')
      .sort((a, b) => b[1] - a[1]);

    const topLabels = sortedLabels.slice(0, 3).map(([k]) => k);
    const topLabelCount = sortedLabels[0]?.[1] ?? 0;
    const specializationStrength = computeStrength(topLabelCount, totalLabeled);

    agentData.push({
      agentPersona: persona,
      totalCompleted,
      topLabels,
      completionRate: Math.round(completionRate * 1000) / 1000,
      avgCompletionTimeMs: Math.round(avgCompletionTimeMs),
      specializationStrength,
      labelCountMap,
    });
  }

  // Batch AI recommendations (4 per call)
  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < agentData.length; i += 4) {
    const batch = agentData.slice(i, i + 4);
    try {
      const batchDesc = batch
        .map(
          (a) =>
            `Agent: ${a.agentPersona}, Strength: ${a.specializationStrength}, TopLabels: [${a.topLabels.join(', ')}], Completed: ${a.totalCompleted}`,
        )
        .join('\n');

      const prompt = `For each agent below, write exactly one sentence recommending which ticket types to route to them (strong/moderate) or how to use them (generalist). Output as JSON array of objects {agent, recommendation}.\n\n${batchDesc}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ agent: string; recommendation: string }>;
        for (const item of parsed) {
          if (item.agent && item.recommendation) {
            recommendationMap.set(item.agent, item.recommendation);
          }
        }
      }
    } catch (e) {
      console.warn('Specialization mapper batch AI failed, using fallback:', e);
    }
  }

  for (const a of agentData) {
    profiles.push({
      agentPersona: a.agentPersona,
      totalCompleted: a.totalCompleted,
      topLabels: a.topLabels,
      completionRate: a.completionRate,
      avgCompletionTimeMs: a.avgCompletionTimeMs,
      specializationStrength: a.specializationStrength,
      recommendation: recommendationMap.get(a.agentPersona) ?? FALLBACK_RECOMMENDATION,
    });
  }

  // Sort: strong → moderate → generalist, then by totalCompleted desc
  profiles.sort((a, b) => {
    const diff = strengthOrder(a.specializationStrength) - strengthOrder(b.specializationStrength);
    return diff !== 0 ? diff : b.totalCompleted - a.totalCompleted;
  });

  // topLabel across all completed tickets
  let topLabel: string | null = null;
  let maxCount = 0;
  for (const [lbl, cnt] of globalLabelCount.entries()) {
    if (cnt > maxCount) {
      maxCount = cnt;
      topLabel = lbl;
    }
  }

  const specialistAgents = profiles.filter((p) => p.specializationStrength === 'strong').length;
  const generalistAgents = profiles.filter((p) => p.specializationStrength === 'generalist').length;

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = profiles
      .map(
        (p) =>
          `${p.agentPersona}: ${p.specializationStrength}, labels=[${p.topLabels.join(', ')}], completed=${p.totalCompleted}`,
      )
      .join('\n');

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize this team's specialization patterns and routing recommendations in 2-3 sentences.\n\n${summaryData}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Specialization mapper summary AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalAgents: profiles.length,
    specialistAgents,
    generalistAgents,
    agentProfiles: profiles,
    topLabel,
    aiSummary,
  };
}
