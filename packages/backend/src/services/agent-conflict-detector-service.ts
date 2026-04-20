import { db } from '../db/connection.js';
import { tickets, epics } from '../db/schema.js';
import { eq, isNotNull, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type ConflictSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface DomainConflict {
  domain: string;
  domainType: 'label' | 'epic';
  agents: string[];
  activeTickets: number;
  totalTickets: number;
  conflictScore: number;
  severity: ConflictSeverity;
  recommendation: string;
}

export interface ConflictReport {
  projectId: string;
  analyzedAt: string;
  totalConflicts: number;
  criticalConflicts: number;
  cleanDomains: number;
  domainConflicts: DomainConflict[];
  aiSummary: string;
}

const FALLBACK_RECOMMENDATION = 'Assign a single lead agent to own this domain and reassign competing tickets.';
const FALLBACK_SUMMARY = 'Review domain conflicts and establish clear agent ownership boundaries to reduce handoff confusion.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function computeSeverity(score: number): ConflictSeverity {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

function severityOrder(s: ConflictSeverity): number {
  switch (s) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'moderate': return 2;
    case 'low': return 3;
  }
}

function computeConflictScore(agents: string[], activeTickets: number, totalTickets: number): number {
  if (totalTickets === 0) return 0;
  const raw = (agents.length - 1) * 20 + (activeTickets / totalTickets * 60);
  return Math.min(100, Math.round(raw * 10) / 10);
}

export async function detectConflicts(projectId: string): Promise<ConflictReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      labels: (tickets as any).labels,
      epicId: tickets.epicId,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const assignedTickets = allTickets.filter((t) => t.assignedPersona != null);

  if (assignedTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalConflicts: 0,
      criticalConflicts: 0,
      cleanDomains: 0,
      domainConflicts: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const ACTIVE_STATUSES_EXCLUDE = ['done', 'backlog'];

  // Label conflicts
  const labelMap = new Map<string, Array<{ persona: string; status: string }>>();
  for (const t of assignedTickets) {
    const lbls = (t.labels as string[] | null) ?? [];
    if (lbls.length === 0) continue;
    for (const lbl of lbls) {
      if (!labelMap.has(lbl)) labelMap.set(lbl, []);
      labelMap.get(lbl)!.push({ persona: t.assignedPersona!, status: t.status });
    }
  }

  // Epic conflicts — fetch epic titles for tickets with epicId
  const epicIds = [...new Set(assignedTickets.filter((t) => t.epicId != null).map((t) => t.epicId!))];
  const epicTitleMap = new Map<string, string>();
  if (epicIds.length > 0) {
    const epicRows = await db
      .select({ id: epics.id, title: epics.title })
      .from(epics)
      .where(inArray(epics.id, epicIds));
    for (const e of epicRows) epicTitleMap.set(e.id, e.title);
  }

  const epicMap = new Map<string, Array<{ persona: string; status: string }>>();
  for (const t of assignedTickets) {
    if (!t.epicId) continue;
    const title = epicTitleMap.get(t.epicId) ?? t.epicId;
    if (!epicMap.has(title)) epicMap.set(title, []);
    epicMap.get(title)!.push({ persona: t.assignedPersona!, status: t.status });
  }

  type RawConflict = Omit<DomainConflict, 'recommendation'>;

  const rawConflicts: RawConflict[] = [];
  let cleanDomains = 0;

  function processMap(map: Map<string, Array<{ persona: string; status: string }>>, domainType: 'label' | 'epic') {
    for (const [domain, rows] of map.entries()) {
      const agents = [...new Set(rows.map((r) => r.persona))];
      if (agents.length === 1) {
        cleanDomains++;
        continue;
      }
      if (agents.length < 2) continue;
      const totalTickets = Number(rows.length);
      const activeTickets = Number(rows.filter((r) => !ACTIVE_STATUSES_EXCLUDE.includes(r.status)).length);
      const conflictScore = computeConflictScore(agents, activeTickets, totalTickets);
      const severity = computeSeverity(conflictScore);
      rawConflicts.push({ domain, domainType, agents, activeTickets, totalTickets, conflictScore, severity });
    }
  }

  processMap(labelMap, 'label');
  processMap(epicMap, 'epic');

  // Sort: critical → high → moderate → low, then conflictScore desc within tier
  rawConflicts.sort((a, b) => {
    const diff = severityOrder(a.severity) - severityOrder(b.severity);
    return diff !== 0 ? diff : b.conflictScore - a.conflictScore;
  });

  if (rawConflicts.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalConflicts: 0,
      criticalConflicts: 0,
      cleanDomains,
      domainConflicts: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  // Batch AI recommendations (4 conflicts per call)
  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < rawConflicts.length; i += 4) {
    const batch = rawConflicts.slice(i, i + 4);
    try {
      const batchDesc = batch
        .map(
          (c) =>
            `Domain: ${c.domain} (${c.domainType}), Agents: [${c.agents.join(', ')}], Score: ${c.conflictScore}, Severity: ${c.severity}`,
        )
        .join('\n');
      const prompt = `For each domain conflict below, write exactly one sentence recommending which agent should own it or how to split responsibility. Output as JSON array of objects {domain, recommendation}.\n\n${batchDesc}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSONFromText(text);
      const parsed = JSON.parse(jsonStr) as Array<{ domain: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.domain && item.recommendation) {
          recommendationMap.set(item.domain, item.recommendation);
        }
      }
    } catch (e) {
      console.warn('Conflict detector batch AI failed, using fallback:', e);
    }
  }

  const domainConflicts: DomainConflict[] = rawConflicts.map((c) => ({
    ...c,
    recommendation: recommendationMap.get(c.domain) ?? FALLBACK_RECOMMENDATION,
  }));

  // AI summary
  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = rawConflicts
      .map((c) => `${c.domain} (${c.domainType}): severity=${c.severity}, agents=[${c.agents.join(', ')}], score=${c.conflictScore}`)
      .join('\n');
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Identify the top conflict hotspot, explain the risk, and give one concrete action to resolve it. Write 2-3 sentences.\n\n${summaryData}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Conflict detector summary AI failed, using fallback:', e);
  }

  const criticalConflicts = domainConflicts.filter((c) => c.severity === 'critical').length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalConflicts: domainConflicts.length,
    criticalConflicts,
    cleanDomains,
    domainConflicts,
    aiSummary,
  };
}
