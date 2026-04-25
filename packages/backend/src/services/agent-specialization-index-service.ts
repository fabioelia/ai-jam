import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type SpecializationTier = 'specialist' | 'balanced' | 'generalist' | 'insufficient_data';

export interface AgentSpecializationIndexMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  uniqueEpics: number;
  uniqueStatuses: number;
  dominantEpicId: string | null;
  dominantEpicTickets: number;
  dominantEpicRatio: number;
  specializationScore: number;
  specializationTier: SpecializationTier;
}

export interface SpecializationIndexReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    specialistCount: number;
    generalistCount: number;
    avgSpecializationScore: number;
    avgEpicsPerAgent: number;
  };
  agents: AgentSpecializationIndexMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSpecializationScore(
  totalTickets: number,
  uniqueEpics: number,
  dominantEpicRatio: number,
): number {
  if (totalTickets < 3) return 0;
  const raw =
    dominantEpicRatio * 60 +
    Math.max(0, 20 - uniqueEpics * 4) +
    Math.min(20, totalTickets * 2);
  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

export function getSpecializationTier(score: number, totalTickets: number): SpecializationTier {
  if (totalTickets < 3) return 'insufficient_data';
  if (score >= 70) return 'specialist';
  if (score >= 40) return 'balanced';
  return 'generalist';
}

export function getSpecializationTierLabel(tier: SpecializationTier): string {
  switch (tier) {
    case 'specialist': return 'Specialist';
    case 'balanced': return 'Balanced';
    case 'generalist': return 'Generalist';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatRatio(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Full Stack Developer';
}

export async function analyzeAgentSpecializationIndex(projectId: string): Promise<SpecializationIndexReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      epicId: tickets.epicId,
      status: tickets.status,
      id: tickets.id,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  type TicketRecord = { epicId: string | null; status: string; id: string };
  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ epicId: row.epicId, status: row.status, id: row.id });
  }

  const agents: AgentSpecializationIndexMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;

    // uniqueEpics: null counts as one group using 'null' as key
    const epicKeySet = new Set(agentTickets.map((t) => t.epicId ?? 'null'));
    const uniqueEpics = epicKeySet.size;

    // uniqueStatuses
    const uniqueStatuses = new Set(agentTickets.map((t) => t.status)).size;

    // dominantEpicId: epicId with highest count; tie → first alphabetically (null treated as '')
    const epicCounts = new Map<string, number>();
    for (const t of agentTickets) {
      const key = t.epicId ?? 'null';
      epicCounts.set(key, (epicCounts.get(key) ?? 0) + 1);
    }

    let dominantEpicKey: string | null = null;
    let dominantEpicTickets = 0;

    const sortedEpicKeys = Array.from(epicCounts.keys()).sort((a, b) => {
      const countDiff = epicCounts.get(b)! - epicCounts.get(a)!;
      if (countDiff !== 0) return countDiff;
      // tie: sort alphabetically, treating 'null' key as ''
      const aSort = a === 'null' ? '' : a;
      const bSort = b === 'null' ? '' : b;
      return aSort.localeCompare(bSort);
    });

    if (sortedEpicKeys.length > 0) {
      dominantEpicKey = sortedEpicKeys[0];
      dominantEpicTickets = epicCounts.get(dominantEpicKey)!;
    }

    const dominantEpicId = dominantEpicKey === 'null' ? null : dominantEpicKey;
    const dominantEpicRatio =
      totalTickets > 0 ? Math.round((dominantEpicTickets / totalTickets) * 1000) / 1000 : 0;

    const specializationScore = computeSpecializationScore(totalTickets, uniqueEpics, dominantEpicRatio);
    const specializationTier = getSpecializationTier(specializationScore, totalTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTickets,
      uniqueEpics,
      uniqueStatuses,
      dominantEpicId,
      dominantEpicTickets,
      dominantEpicRatio,
      specializationScore,
      specializationTier,
    });
  }

  agents.sort((a, b) => b.specializationScore - a.specializationScore);

  const specialistCount = agents.filter((a) => a.specializationTier === 'specialist').length;
  const generalistCount = agents.filter((a) => a.specializationTier === 'generalist').length;
  const avgSpecializationScore =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.specializationScore, 0) / agents.length) * 10) / 10
      : 0;
  const avgEpicsPerAgent =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.uniqueEpics, 0) / agents.length) * 10) / 10
      : 0;

  const aiSummary =
    `Specialization analysis complete for ${agents.length} agents. ` +
    `${specialistCount} agents are specialists, ${generalistCount} are generalists. ` +
    `Average specialization score: ${avgSpecializationScore}.`;

  const aiRecommendations = [
    'Specialist agents excel in their domain — leverage them for complex epic-specific tasks.',
    'Generalist agents provide flexibility but may lack depth — consider pairing with specialists.',
    'High epic concentration may indicate siloed work; ensure cross-epic knowledge sharing.',
    'Review agents with low ticket counts as their specialization data may be incomplete.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      specialistCount,
      generalistCount,
      avgSpecializationScore,
      avgEpicsPerAgent,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
