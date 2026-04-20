import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AgentPriorityRecord {
  agentPersona: string;
  totalActiveTickets: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  highestPriorityWorking: TicketPriority | null;
  lowestPriorityWorking: TicketPriority | null;
  alignmentScore: number;
  alignmentStatus: 'aligned' | 'drifting' | 'misaligned';
  explanation: string;
}

export interface PriorityAlignmentReport {
  projectId: string;
  analyzedAt: string;
  totalAgentsAnalyzed: number;
  totalActiveTickets: number;
  alignedAgents: number;
  driftingAgents: number;
  misalignedAgents: number;
  agentRecords: AgentPriorityRecord[];
  aiRecommendation: string;
}

const PRIORITY_RANK: Record<TicketPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_ORDER: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

const FALLBACK_RECOMMENDATION =
  'Ensure agents address critical and high-priority tickets before medium and low-priority work.';

function computeAlignmentStatus(score: number): AgentPriorityRecord['alignmentStatus'] {
  if (score >= 0.75) return 'aligned';
  if (score >= 0.4) return 'drifting';
  return 'misaligned';
}

function computeExplanation(record: Omit<AgentPriorityRecord, 'explanation'>): string {
  const { agentPersona, alignmentStatus, criticalCount, highCount, mediumCount, lowCount, alignmentScore } = record;
  const pct = (alignmentScore * 100).toFixed(0);
  if (alignmentStatus === 'aligned') {
    return `${agentPersona} is working high-priority tickets (${pct}% alignment score).`;
  }
  if (alignmentStatus === 'drifting') {
    const low = mediumCount + lowCount;
    return `${agentPersona} has ${low} medium/low ticket(s) alongside ${criticalCount + highCount} critical/high — ${pct}% alignment.`;
  }
  return `${agentPersona} is focused on low-priority work (${mediumCount} medium, ${lowCount} low) while ${criticalCount + highCount} critical/high ticket(s) are assigned — ${pct}% alignment.`;
}

export async function analyzeAgentPriorityAlignment(projectId: string): Promise<PriorityAlignmentReport> {
  const activeTickets = await db
    .select({
      id: tickets.id,
      priority: tickets.priority,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        inArray(tickets.status, ['in_progress']),
        isNotNull(tickets.assignedPersona),
      ),
    );

  if (activeTickets.length === 0) {
    return {
      projectId,
      analyzedAt: new Date().toISOString(),
      totalAgentsAnalyzed: 0,
      totalActiveTickets: 0,
      alignedAgents: 0,
      driftingAgents: 0,
      misalignedAgents: 0,
      agentRecords: [],
      aiRecommendation: FALLBACK_RECOMMENDATION,
    };
  }

  const agentMap = new Map<string, { critical: number; high: number; medium: number; low: number }>();

  for (const t of activeTickets) {
    const persona = t.assignedPersona as string;
    if (!agentMap.has(persona)) {
      agentMap.set(persona, { critical: 0, high: 0, medium: 0, low: 0 });
    }
    const counts = agentMap.get(persona)!;
    const p = (t.priority ?? 'medium') as TicketPriority;
    if (p in counts) counts[p as keyof typeof counts]++;
  }

  const agentRecords: AgentPriorityRecord[] = [];

  for (const [persona, counts] of agentMap) {
    const tickets: TicketPriority[] = [
      ...Array(counts.critical).fill('critical' as TicketPriority),
      ...Array(counts.high).fill('high' as TicketPriority),
      ...Array(counts.medium).fill('medium' as TicketPriority),
      ...Array(counts.low).fill('low' as TicketPriority),
    ];

    const total = tickets.length;
    const avgRank = tickets.reduce((sum, p) => sum + PRIORITY_RANK[p], 0) / total;
    const alignmentScore = avgRank / 4;
    const alignmentStatus = computeAlignmentStatus(alignmentScore);

    const working = tickets.slice().sort((a, b) => PRIORITY_RANK[b] - PRIORITY_RANK[a]);
    const highestPriorityWorking = working[0] ?? null;
    const lowestPriorityWorking = working[working.length - 1] ?? null;

    const partial: Omit<AgentPriorityRecord, 'explanation'> = {
      agentPersona: persona,
      totalActiveTickets: total,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      highestPriorityWorking,
      lowestPriorityWorking,
      alignmentScore,
      alignmentStatus,
    };

    agentRecords.push({ ...partial, explanation: computeExplanation(partial) });
  }

  agentRecords.sort((a, b) => a.alignmentScore - b.alignmentScore);

  const alignedAgents = agentRecords.filter((r) => r.alignmentStatus === 'aligned').length;
  const driftingAgents = agentRecords.filter((r) => r.alignmentStatus === 'drifting').length;
  const misalignedAgents = agentRecords.filter((r) => r.alignmentStatus === 'misaligned').length;

  let aiRecommendation = FALLBACK_RECOMMENDATION;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentRecords
      .map(
        (r) =>
          `Agent: ${r.agentPersona}, Score: ${(r.alignmentScore * 100).toFixed(0)}%, Status: ${r.alignmentStatus}, Critical: ${r.criticalCount}, High: ${r.highCount}, Medium: ${r.mediumCount}, Low: ${r.lowCount}`,
      )
      .join('\n');

    const prompt = `Analyze this agent priority alignment data and write a single paragraph (2-3 sentences) with an actionable recommendation for improving priority alignment. Be concise.\n\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) aiRecommendation = content;
  } catch (e) {
    console.warn('Priority alignment AI recommendation failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: new Date().toISOString(),
    totalAgentsAnalyzed: agentRecords.length,
    totalActiveTickets: activeTickets.length,
    alignedAgents,
    driftingAgents,
    misalignedAgents,
    agentRecords,
    aiRecommendation,
  };
}
