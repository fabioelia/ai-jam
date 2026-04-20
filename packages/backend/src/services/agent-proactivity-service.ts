import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
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

export function computeProactivityScore(
  unpromptedNoteCount: number,
  blockerFlagCount: number,
  suggestionCount: number,
  totalTasks: number,
): number {
  if (totalTasks === 0) return 0;
  const noteRate = Math.min(unpromptedNoteCount / totalTasks, 1) * 40;
  const blockerRate = Math.min(blockerFlagCount / totalTasks, 1) * 35;
  const suggestionRate = Math.min(suggestionCount / totalTasks, 1) * 25;
  return Math.max(0, Math.min(100, Math.round(noteRate + blockerRate + suggestionRate)));
}

export function computeProactivityTier(score: number): AgentProactivityMetrics['proactivityTier'] {
  if (score >= 75) return 'proactive';
  if (score >= 50) return 'engaged';
  if (score >= 25) return 'reactive';
  return 'passive';
}

export async function analyzeAgentProactivity(projectId: string): Promise<AgentProactivityReport> {
  const now = new Date().toISOString();

  const projectTickets = await db
    .select({ id: tickets.id })
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
      insights: [],
      recommendations: [],
    };
  }

  const sessionRows = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      retryCount: agentSessions.retryCount,
    })
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

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
      insights: [],
      recommendations: [],
    };
  }

  const sessionsByAgent = new Map<string, typeof sessionRows>();
  for (const s of sessionRows) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const agents: AgentProactivityMetrics[] = [];

  for (const [personaType, agentSess] of sessionsByAgent.entries()) {
    const totalTasks = agentSess.length;
    // Proxy: completed sessions that had retries indicate proactive note/blocker behavior
    const completedWithRetries = agentSess.filter(
      (s) => s.status === 'completed' && (s.retryCount ?? 0) > 0,
    ).length;
    // Proxy: failed sessions indicate blockers were flagged
    const failedSessions = agentSess.filter((s) => s.status === 'failed').length;
    // Proxy: completed without retries = suggestions accepted
    const completedClean = agentSess.filter(
      (s) => s.status === 'completed' && (s.retryCount ?? 0) === 0,
    ).length;

    const unpromptedNoteCount = completedWithRetries;
    const blockerFlagCount = failedSessions;
    const suggestionCount = completedClean;
    const earlyWarningCount = failedSessions;

    const proactivityScore = computeProactivityScore(
      unpromptedNoteCount,
      blockerFlagCount,
      suggestionCount,
      totalTasks,
    );
    const proactivityTier = computeProactivityTier(proactivityScore);

    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalTasks,
      unpromptedNoteCount,
      blockerFlagCount,
      suggestionCount,
      earlyWarningCount,
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
  const proactiveAgents = agents.filter((a) => a.proactivityScore >= 75).length;

  const insights: string[] = [];
  if (proactiveAgents > 0) {
    insights.push(`${proactiveAgents} agent(s) are highly proactive in flagging issues and providing suggestions.`);
  }
  const passive = agents.filter((a) => a.proactivityTier === 'passive');
  if (passive.length > 0) {
    insights.push(`${passive.length} agent(s) operate passively and may need encouragement to engage more proactively.`);
  }

  const recommendations: string[] = [];
  if (passive.length > 0) {
    recommendations.push('Encourage passive agents to flag blockers and add notes during task execution.');
  }
  recommendations.push('Share proactive agent practices as a model for the broader team.');

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
  };
}
