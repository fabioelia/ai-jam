import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentFeedbackData {
  agentId: string;
  agentName: string;
  feedbackReceived: number;
  feedbackActedOn: number;
  integrationRate: number;
  responsivenessTier: 'proactive' | 'responsive' | 'selective' | 'resistant';
  avgResponseTimeHours: number;
  integrationScore: number;
}

export interface AgentFeedbackIntegrationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalFeedbackItems: number;
    avgIntegrationRate: number;
    topResponsiveAgent: string | null;
    leastResponsiveAgent: string | null;
    proactiveAgentCount: number;
  };
  agents: AgentFeedbackData[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeFeedbackIntegrationScore(
  feedbackReceived: number,
  feedbackActedOn: number,
  avgResponseTimeHours: number,
): number {
  if (feedbackReceived === 0) return 50;
  let base = (feedbackActedOn / Math.max(feedbackReceived, 1)) * 100;
  if (avgResponseTimeHours < 2) base += 10;
  if (avgResponseTimeHours > 24) base -= 15;
  return Math.max(0, Math.min(100, Math.round(base)));
}

export function getResponsivenessTier(integrationRate: number): AgentFeedbackData['responsivenessTier'] {
  if (integrationRate >= 80) return 'proactive';
  if (integrationRate >= 60) return 'responsive';
  if (integrationRate >= 40) return 'selective';
  return 'resistant';
}

export async function analyzeAgentFeedbackIntegration(
  projectId: string,
): Promise<AgentFeedbackIntegrationReport> {
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
      summary: { totalFeedbackItems: 0, avgIntegrationRate: 0, topResponsiveAgent: null, leastResponsiveAgent: null, proactiveAgentCount: 0 },
      agents: [],
      aiSummary: 'No agent data available for feedback integration analysis.',
      aiRecommendations: ['Collect agent session data to enable feedback integration analysis.'],
    };
  }

  const sessionRows = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      retryCount: agentSessions.retryCount,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: { totalFeedbackItems: 0, avgIntegrationRate: 0, topResponsiveAgent: null, leastResponsiveAgent: null, proactiveAgentCount: 0 },
      agents: [],
      aiSummary: 'No agent session data found.',
      aiRecommendations: ['Start running agent sessions to enable feedback analysis.'],
    };
  }

  const sessionsByAgent = new Map<string, typeof sessionRows>();
  for (const s of sessionRows) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const agents: AgentFeedbackData[] = [];

  for (const [personaType, agentSess] of sessionsByAgent.entries()) {
    const feedbackReceived = agentSess.length;
    const feedbackActedOn = agentSess.filter((s) => s.status === 'completed').length;
    const integrationRate =
      feedbackReceived > 0 ? Math.round((feedbackActedOn / feedbackReceived) * 100) : 0;

    const responseTimes: number[] = [];
    for (const s of agentSess) {
      if (s.startedAt && s.completedAt) {
        const hours = (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 3600000;
        responseTimes.push(hours);
      }
    }
    const avgResponseTimeHours =
      responseTimes.length > 0
        ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
        : 0;

    const integrationScore = computeFeedbackIntegrationScore(
      feedbackReceived,
      feedbackActedOn,
      avgResponseTimeHours,
    );
    const responsivenessTier = getResponsivenessTier(integrationRate);

    agents.push({
      agentId: personaType,
      agentName: personaType,
      feedbackReceived,
      feedbackActedOn,
      integrationRate,
      responsivenessTier,
      avgResponseTimeHours,
      integrationScore,
    });
  }

  agents.sort((a, b) => b.integrationScore - a.integrationScore);

  const totalFeedbackItems = agents.reduce((s, a) => s + a.feedbackReceived, 0);
  const avgIntegrationRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.integrationRate, 0) / agents.length)
      : 0;
  const topResponsiveAgent = agents.length > 0 ? agents[0].agentName : null;
  const leastResponsiveAgent = agents.length > 0 ? agents[agents.length - 1].agentName : null;
  const proactiveAgentCount = agents.filter((a) => a.responsivenessTier === 'proactive').length;

  return {
    projectId,
    generatedAt: now,
    summary: { totalFeedbackItems, avgIntegrationRate, topResponsiveAgent, leastResponsiveAgent, proactiveAgentCount },
    agents,
    aiSummary: `Analyzed ${agents.length} agent(s) with avg integration rate of ${avgIntegrationRate}%.`,
    aiRecommendations: [
      'Focus on improving feedback response time for resistant agents.',
      'Share practices from proactive agents across the team.',
    ],
  };
}
