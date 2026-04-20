import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentSpecializationDriftMetrics {
  personaId: string;
  primarySpecialization: string;
  totalTicketsHandled: number;
  inSpecializationCount: number;
  outOfSpecializationCount: number;
  specializationAlignmentPct: number;
  driftScore: number;
  driftLevel: 'aligned' | 'minor_drift' | 'significant_drift' | 'off_track';
  taskTypeBreakdown: Record<string, number>;
}

export interface SpecializationDriftReport {
  agents: AgentSpecializationDriftMetrics[];
  systemAvgAlignmentPct: number;
  mostAlignedAgent: string | null;
  mostDriftedAgent: string | null;
  systemTotalTickets: number;
  aiSummary: string;
  aiRecommendations: string[];
}

const FALLBACK_SUMMARY = 'Unable to generate AI analysis. Review agent specialization alignment manually.';
const FALLBACK_RECOMMENDATIONS = [
  'Audit task assignments to ensure agents work within their specializations.',
  'Consider adding routing rules to direct tickets to the most appropriate persona.',
  'Review personas with high drift scores for potential role clarification.',
];

export function inferSpecialization(personaId: string): string {
  const id = personaId.toLowerCase();
  if (id.includes('develop') || id.includes('engineer') || id.includes('backend') || id.includes('frontend')) return 'engineering';
  if (id.includes('qa') || id.includes('test') || id.includes('quality')) return 'quality';
  if (id.includes('design') || id.includes('ux') || id.includes('ui')) return 'design';
  if (id.includes('product') || id.includes('pm') || id.includes('manager')) return 'product';
  if (id.includes('research') || id.includes('analyst')) return 'research';
  return 'general';
}

export function inferTicketType(ticket: { title: string; description?: string }): string {
  const text = `${ticket.title} ${ticket.description ?? ''}`.toLowerCase();
  if (text.match(/\b(api|backend|database|server|migration|schema|endpoint)\b/)) return 'engineering';
  if (text.match(/\b(frontend|component|modal|button|style|css|react)\b/)) return 'engineering';
  if (text.match(/\b(test|qa|verify|bug|fix|regression|pass|fail)\b/)) return 'quality';
  if (text.match(/\b(design|wireframe|mockup|figma|layout|ux)\b/)) return 'design';
  if (text.match(/\b(research|analyze|investigate|report|spec|requirement)\b/)) return 'research';
  if (text.match(/\b(plan|roadmap|feature|backlog|priority|milestone)\b/)) return 'product';
  return 'general';
}

function classifyDriftLevel(driftScore: number): AgentSpecializationDriftMetrics['driftLevel'] {
  if (driftScore < 20) return 'aligned';
  if (driftScore < 40) return 'minor_drift';
  if (driftScore < 60) return 'significant_drift';
  return 'off_track';
}

const VALID_STATUSES = new Set(['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done']);

export async function analyzeSpecializationDrift(projectId: string): Promise<SpecializationDriftReport> {
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

  const assignedTickets = allTickets.filter(
    (t) => t.assignedPersona && VALID_STATUSES.has(t.status as string),
  );

  if (assignedTickets.length === 0) {
    return {
      agents: [],
      systemAvgAlignmentPct: 0,
      mostAlignedAgent: null,
      mostDriftedAgent: null,
      systemTotalTickets: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Group tickets by persona
  const personaMap = new Map<string, Array<{ title: string; description?: string; ticketType: string }>>();
  for (const ticket of assignedTickets) {
    const persona = ticket.assignedPersona as string;
    if (!personaMap.has(persona)) personaMap.set(persona, []);
    const ticketType = inferTicketType({ title: ticket.title, description: ticket.description ?? undefined });
    personaMap.get(persona)!.push({ title: ticket.title, description: ticket.description ?? undefined, ticketType });
  }

  const agents: AgentSpecializationDriftMetrics[] = [];

  for (const [personaId, ticketList] of personaMap.entries()) {
    const primarySpecialization = inferSpecialization(personaId);
    const totalTicketsHandled = ticketList.length;

    const taskTypeBreakdown: Record<string, number> = {};
    for (const t of ticketList) {
      taskTypeBreakdown[t.ticketType] = (taskTypeBreakdown[t.ticketType] ?? 0) + 1;
    }

    const inSpecializationCount = primarySpecialization === 'general'
      ? totalTicketsHandled
      : (taskTypeBreakdown[primarySpecialization] ?? 0);
    const outOfSpecializationCount = totalTicketsHandled - inSpecializationCount;

    const specializationAlignmentPct = totalTicketsHandled > 0
      ? (inSpecializationCount / totalTicketsHandled) * 100
      : 100;
    const driftScore = 100 - specializationAlignmentPct;
    const driftLevel = classifyDriftLevel(driftScore);

    agents.push({
      personaId,
      primarySpecialization,
      totalTicketsHandled,
      inSpecializationCount,
      outOfSpecializationCount,
      specializationAlignmentPct: Math.round(specializationAlignmentPct * 10) / 10,
      driftScore: Math.round(driftScore * 10) / 10,
      driftLevel,
      taskTypeBreakdown,
    });
  }

  const systemTotalTickets = assignedTickets.length;
  const systemAvgAlignmentPct = agents.length > 0
    ? agents.reduce((sum, a) => sum + a.specializationAlignmentPct, 0) / agents.length
    : 0;

  const sortedByAlignment = [...agents].sort((a, b) => b.specializationAlignmentPct - a.specializationAlignmentPct);
  const mostAlignedAgent = sortedByAlignment[0]?.personaId ?? null;
  const mostDriftedAgent = sortedByAlignment[sortedByAlignment.length - 1]?.personaId ?? null;

  // AI summary
  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentLines = agents
      .map(
        (a) =>
          `Persona: ${a.personaId}, specialization: ${a.primarySpecialization}, alignmentPct: ${a.specializationAlignmentPct}, driftLevel: ${a.driftLevel}`,
      )
      .join('\n');

    const prompt = `You are an AI specialization analyst. Analyze the following agent specialization drift data and return a JSON object with "aiSummary" (one-paragraph string) and "aiRecommendations" (array of 3 actionable strings). Output ONLY valid JSON, no other text.

${agentLines}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.aiSummary) aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.aiRecommendations) && parsed.aiRecommendations.length > 0) {
        aiRecommendations = parsed.aiRecommendations;
      }
    }
  } catch (e) {
    console.warn('Agent specialization drift AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    systemAvgAlignmentPct: Math.round(systemAvgAlignmentPct * 10) / 10,
    mostAlignedAgent,
    mostDriftedAgent,
    systemTotalTickets,
    aiSummary,
    aiRecommendations,
  };
}
