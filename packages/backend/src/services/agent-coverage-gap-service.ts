import { db } from '../db/connection.js';
import { tickets, epics } from '../db/schema.js';
import { and, eq, notInArray, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface CoverageArea {
  areaType: 'status' | 'epic' | 'label';
  areaId: string;
  areaName: string;
  activeTickets: number;
  agentsCovering: number;
  lastAgentActivity: string | null;
  gapSeverity: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface CoverageGapReport {
  projectId: string;
  analyzedAt: string;
  totalAreas: number;
  coveredAreas: number;
  uncoveredAreas: number;
  criticalGaps: number;
  coverageScore: number;
  areas: CoverageArea[];
  aiSummary: string;
}

const FALLBACK_REC = 'Assign an available agent to this area immediately to prevent work stalling.';
const FALLBACK_SUMMARY_TEMPLATE = (score: number, critical: number) =>
  `Coverage score: ${score}%. ${critical} critical gaps need immediate agent assignment.`;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

type RawArea = {
  areaType: 'status' | 'epic' | 'label';
  areaId: string;
  areaName: string;
  activeTickets: number;
  agentsCovering: number;
  lastAgentActivity: string | null;
  gapSeverity: 'critical' | 'high' | 'moderate' | 'low' | null;
};

function computeSeverity(
  activeTickets: number,
  agentsCovering: number,
  lastAgentActivity: Date | null,
  staleThreshold: Date,
): 'critical' | 'high' | 'moderate' | 'low' | null {
  if (agentsCovering === 0) {
    if (activeTickets >= 3) return 'critical';
    if (activeTickets >= 2) return 'high';
    if (activeTickets >= 1) return 'moderate';
    return null;
  }
  if (activeTickets >= 5 && agentsCovering <= 1) return 'high';
  if (lastAgentActivity && lastAgentActivity < staleThreshold) return 'low';
  return null;
}

function buildArea(
  areaType: 'status' | 'epic' | 'label',
  areaId: string,
  areaName: string,
  areaTickets: Array<{ assignedPersona: string | null; updatedAt: Date | null }>,
  activityThreshold: Date,
  staleThreshold: Date,
): RawArea {
  const activeTickets = areaTickets.length;
  const recent = areaTickets.filter(
    (t) => t.assignedPersona != null && t.updatedAt != null && new Date(t.updatedAt) >= activityThreshold,
  );
  const agentsCovering = new Set(recent.map((t) => t.assignedPersona!)).size;

  const touchedByAgent = areaTickets
    .filter((t) => t.assignedPersona != null && t.updatedAt != null)
    .map((t) => new Date(t.updatedAt!).getTime());
  const maxTouch = touchedByAgent.length > 0 ? new Date(Math.max(...touchedByAgent)) : null;
  const lastAgentActivity = maxTouch ? maxTouch.toISOString() : null;

  const gapSeverity = computeSeverity(activeTickets, agentsCovering, maxTouch, staleThreshold);

  return { areaType, areaId, areaName, activeTickets, agentsCovering, lastAgentActivity, gapSeverity };
}

export async function analyzeCoverageGaps(projectId: string): Promise<CoverageGapReport> {
  const now = new Date();
  const activityThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const INACTIVE_STATUSES = ['done', 'cancelled'];

  const activeTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      epicId: tickets.epicId,
      labels: (tickets as any).labels,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        notInArray(tickets.status, INACTIVE_STATUSES as any),
      ),
    );

  if (activeTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalAreas: 0,
      coveredAreas: 0,
      uncoveredAreas: 0,
      criticalGaps: 0,
      coverageScore: 100,
      areas: [],
      aiSummary: FALLBACK_SUMMARY_TEMPLATE(100, 0),
    };
  }

  // Build epic name map
  const epicIds = [...new Set(activeTickets.filter((t) => t.epicId != null).map((t) => t.epicId!))];
  const epicNameMap = new Map<string, string>();
  if (epicIds.length > 0) {
    const epicRows = await db
      .select({ id: epics.id, title: epics.title })
      .from(epics)
      .where(inArray(epics.id, epicIds));
    for (const e of epicRows) epicNameMap.set(e.id, e.title);
  }

  const rawAreas: RawArea[] = [];

  // Status areas
  const statusMap = new Map<string, typeof activeTickets>();
  for (const t of activeTickets) {
    if (!statusMap.has(t.status)) statusMap.set(t.status, []);
    statusMap.get(t.status)!.push(t);
  }
  for (const [status, ts] of statusMap.entries()) {
    rawAreas.push(buildArea('status', status, status, ts, activityThreshold, staleThreshold));
  }

  // Epic areas
  const epicMap = new Map<string, typeof activeTickets>();
  for (const t of activeTickets) {
    if (!t.epicId) continue;
    if (!epicMap.has(t.epicId)) epicMap.set(t.epicId, []);
    epicMap.get(t.epicId)!.push(t);
  }
  for (const [epicId, ts] of epicMap.entries()) {
    const name = epicNameMap.get(epicId) ?? epicId;
    rawAreas.push(buildArea('epic', epicId, name, ts, activityThreshold, staleThreshold));
  }

  // Label areas
  const labelMap = new Map<string, typeof activeTickets>();
  for (const t of activeTickets) {
    const labels: string[] = Array.isArray(t.labels) ? t.labels : [];
    for (const lbl of labels) {
      if (!labelMap.has(lbl)) labelMap.set(lbl, []);
      labelMap.get(lbl)!.push(t);
    }
  }
  for (const [lbl, ts] of labelMap.entries()) {
    rawAreas.push(buildArea('label', lbl, lbl, ts, activityThreshold, staleThreshold));
  }

  const totalAreas = rawAreas.length;
  const coveredAreas = rawAreas.filter((a) => a.gapSeverity === null).length;
  const uncoveredAreas = totalAreas - coveredAreas;
  const coverageScore = totalAreas > 0 ? Math.round((coveredAreas / totalAreas) * 100) : 100;

  const gappedAreas = rawAreas.filter((a) => a.gapSeverity !== null) as Array<RawArea & { gapSeverity: NonNullable<RawArea['gapSeverity']> }>;

  gappedAreas.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.gapSeverity] - SEVERITY_ORDER[b.gapSeverity];
    return sd !== 0 ? sd : b.activeTickets - a.activeTickets;
  });

  const criticalGaps = gappedAreas.filter((a) => a.gapSeverity === 'critical').length;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  // Generate per-area recommendations
  const recMap = new Map<string, string>();
  for (let i = 0; i < gappedAreas.length; i += 4) {
    const batch = gappedAreas.slice(i, i + 4);
    try {
      const desc = batch
        .map(
          (a) =>
            `Area: ${a.areaName} (${a.areaType}), Severity: ${a.gapSeverity}, ActiveTickets: ${a.activeTickets}, AgentsCovering: ${a.agentsCovering}`,
        )
        .join('\n');
      const prompt = `For each board area below, write exactly one sentence recommending how to close the coverage gap. Output as JSON array [{areaId, recommendation}] using areaName as areaId.\n\n${desc}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSON(text);
      const parsed = JSON.parse(jsonStr) as Array<{ areaId: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.areaId && item.recommendation) recMap.set(item.areaId, item.recommendation);
      }
    } catch (e) {
      console.warn('Coverage gap batch AI failed, using fallback:', e);
    }
  }

  const areas: CoverageArea[] = gappedAreas.map((a) => ({
    areaType: a.areaType,
    areaId: a.areaId,
    areaName: a.areaName,
    activeTickets: a.activeTickets,
    agentsCovering: a.agentsCovering,
    lastAgentActivity: a.lastAgentActivity,
    gapSeverity: a.gapSeverity,
    recommendation: recMap.get(a.areaName) ?? FALLBACK_REC,
  }));

  let aiSummary = FALLBACK_SUMMARY_TEMPLATE(coverageScore, criticalGaps);
  try {
    const top3 = gappedAreas
      .slice(0, 3)
      .map((a) => `${a.areaName} (${a.areaType}): ${a.gapSeverity}, ${a.activeTickets} active tickets, ${a.agentsCovering} agents`)
      .join('\n');
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize board coverage health in 2-3 sentences. Coverage score: ${coverageScore}%, ${criticalGaps} critical gaps. Top uncovered areas:\n${top3}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Coverage gap summary AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalAreas,
    coveredAreas,
    uncoveredAreas,
    criticalGaps,
    coverageScore,
    areas,
    aiSummary,
  };
}

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}
