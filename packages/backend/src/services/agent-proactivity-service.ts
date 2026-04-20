import { db } from '../db/connection.js';
import { tickets, agentSessions, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentProactivityMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  unpromptedNoteCount: number;
  blockerFlagCount: number;
  suggestionCount: number;
  earlyWarningCount: number;
  proactivityScore: number;
  proactivityTier: 'proactive' | 'engaged' | 'reactive' | 'passive';
}

export interface AgentProactivityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProactivityScore: number;
    mostProactive: string | null;
    leastProactive: string | null;
    proactiveAgents: number;
  };
  agents: AgentProactivityMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

/**
 * Compute a proactivity score (0-100) for an agent based on:
 * - ticketsCreated: tickets created by the agent (createdBy = personaType match is approximated from sessions)
 * - totalTasks: total tasks (sessions) the agent was involved with
 * - unpromptedNoteCount: notes/handoffs the agent added on their own
 * - blockerFlagCount: how many blockers they flagged
 * - suggestionCount: notes flagged as suggestions
 * - earlyWarningCount: early-warning style notes
 *
 * Higher ratios of self-initiated actions → higher score.
 */
export function computeProactivityScore(
  ticketsCreated: number,
  totalTasks: number,
  unpromptedNoteCount: number,
  blockerFlagCount: number,
  suggestionCount: number,
): number {
  if (totalTasks === 0) return 0;

  // Initiation ratio (0–50 points): how often they create vs. just receive work
  const initiationRatio = Math.min(ticketsCreated / Math.max(totalTasks, 1), 1);
  const initiationPoints = initiationRatio * 50;

  // Engagement bonus (0–30 points): unprompted notes + blocker flags + suggestions
  const proactiveActions = unpromptedNoteCount + blockerFlagCount + suggestionCount;
  const engagementPoints = Math.min((proactiveActions / Math.max(totalTasks, 1)) * 30, 30);

  // Volume bonus (0–20 points): reward agents who do a lot
  const volumePoints = Math.min((totalTasks / 10) * 20, 20);

  const raw = initiationPoints + engagementPoints + volumePoints;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getProactivityTier(score: number): AgentProactivityMetrics['proactivityTier'] {
  if (score >= 75) return 'proactive';
  if (score >= 50) return 'engaged';
  if (score >= 25) return 'reactive';
  return 'passive';
}

export async function analyzeAgentProactivity(
  projectId: string,
): Promise<AgentProactivityReport> {
  const now = new Date().toISOString();

  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  if (ticketIds.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: {
        totalAgents: 0,
        avgProactivityScore: 0,
        mostProactive: null,
        leastProactive: null,
        proactiveAgents: 0,
      },
      agents: [],
      insights: ['No ticket data available for proactivity analysis.'],
      recommendations: ['Collect agent activity data to enable proactivity analysis.'],
      aiSummary: 'No ticket data available for proactivity analysis.',
      aiRecommendations: ['Start creating tickets and running agent sessions to enable analysis.'],
    };
  }

  // Fetch sessions
  const sessionRows = await db
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
    })
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  // Fetch notes / handoffs created by agents
  const noteRows = await db
    .select({
      authorId: ticketNotes.authorId,
      authorType: ticketNotes.authorType,
      handoffFrom: ticketNotes.handoffFrom,
      content: ticketNotes.content,
      ticketId: ticketNotes.ticketId,
    })
    .from(ticketNotes)
    .where(inArray(ticketNotes.ticketId, ticketIds));

  if (sessionRows.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: {
        totalAgents: 0,
        avgProactivityScore: 0,
        mostProactive: null,
        leastProactive: null,
        proactiveAgents: 0,
      },
      agents: [],
      insights: ['No agent session data found.'],
      recommendations: ['Start running agent sessions to enable proactivity analysis.'],
      aiSummary: 'No agent session data found.',
      aiRecommendations: ['Run agent sessions to populate proactivity data.'],
    };
  }

  // Build per-agent task sets
  const agentTaskMap = new Map<string, Set<string>>();
  for (const s of sessionRows) {
    if (!s.ticketId) continue;
    const tasks = agentTaskMap.get(s.personaType) ?? new Set<string>();
    tasks.add(s.ticketId);
    agentTaskMap.set(s.personaType, tasks);
  }

  // Count tickets assigned to each agent persona
  const assignedCounts = new Map<string, number>();
  for (const t of projectTickets) {
    if (t.assignedPersona) {
      assignedCounts.set(t.assignedPersona, (assignedCounts.get(t.assignedPersona) ?? 0) + 1);
    }
  }

  // Approximate "tickets created by agent" as tasks that are NOT in assigned pool
  // (sessions on unassigned tickets imply the agent initiated or self-selected work)
  const agentCreatedMap = new Map<string, number>();
  for (const [agentId, tasks] of agentTaskMap.entries()) {
    const assigned = assignedCounts.get(agentId) ?? 0;
    const total = tasks.size;
    // Heuristic: tasks beyond assigned are "self-initiated"
    const created = Math.max(0, total - assigned);
    agentCreatedMap.set(agentId, created);
  }

  // Count per-agent notes
  const agentNoteMap = new Map<
    string,
    { unprompted: number; blockers: number; suggestions: number; earlyWarnings: number }
  >();
  for (const note of noteRows) {
    const agentId = note.authorId;
    if (note.authorType !== 'agent') continue;
    const counts = agentNoteMap.get(agentId) ?? {
      unprompted: 0,
      blockers: 0,
      suggestions: 0,
      earlyWarnings: 0,
    };
    // Classify notes heuristically by content keywords
    const lower = (note.content ?? '').toLowerCase();
    if (lower.includes('blocker') || lower.includes('blocked')) counts.blockers += 1;
    else if (lower.includes('suggest') || lower.includes('recommend')) counts.suggestions += 1;
    else if (lower.includes('warn') || lower.includes('risk') || lower.includes('early')) counts.earlyWarnings += 1;
    else counts.unprompted += 1;
    agentNoteMap.set(agentId, counts);

    // Also count handoff-initiated notes
    if (note.handoffFrom === agentId) {
      counts.unprompted += 1;
    }
  }

  // Build agent metrics
  const agents: AgentProactivityMetrics[] = [];
  for (const [agentId, tasks] of agentTaskMap.entries()) {
    const totalTasks = tasks.size;
    const ticketsCreated = agentCreatedMap.get(agentId) ?? 0;
    const notes = agentNoteMap.get(agentId) ?? {
      unprompted: 0,
      blockers: 0,
      suggestions: 0,
      earlyWarnings: 0,
    };
    const proactivityScore = computeProactivityScore(
      ticketsCreated,
      totalTasks,
      notes.unprompted,
      notes.blockers,
      notes.suggestions,
    );
    const proactivityTier = getProactivityTier(proactivityScore);
    agents.push({
      agentId,
      agentName: agentId,
      totalTasks,
      unpromptedNoteCount: notes.unprompted,
      blockerFlagCount: notes.blockers,
      suggestionCount: notes.suggestions,
      earlyWarningCount: notes.earlyWarnings,
      proactivityScore,
      proactivityTier,
    });
  }

  agents.sort((a, b) => b.proactivityScore - a.proactivityScore);

  const avgProactivityScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.proactivityScore, 0) / agents.length)
      : 0;

  const mostProactive = agents.length > 0 ? agents[0].agentName : null;
  const leastProactive = agents.length > 0 ? agents[agents.length - 1].agentName : null;
  const proactiveAgents = agents.filter((a) => a.proactivityTier === 'proactive').length;

  const insights: string[] = [
    `${agents.length} agent(s) analyzed across ${ticketIds.length} ticket(s).`,
    `Average proactivity score: ${avgProactivityScore}/100.`,
    `${proactiveAgents} agent(s) classified as proactive (score ≥ 75).`,
  ];

  const recommendations: string[] = [
    'Encourage passive agents to initiate tickets rather than waiting for assignments.',
    'Recognize proactive agents who flag blockers and suggest improvements early.',
    'Review reactive agents for context or tooling gaps that prevent self-direction.',
  ];

  return {
    projectId,
    generatedAt: now,
    summary: {
      totalAgents: agents.length,
      avgProactivityScore,
      mostProactive,
      leastProactive,
      proactiveAgents,
    },
    agents,
    insights,
    recommendations,
    aiSummary: `Analyzed ${agents.length} agent(s). Avg proactivity score: ${avgProactivityScore}/100. ${proactiveAgents} proactive agent(s) detected.`,
    aiRecommendations: recommendations,
  };
}
