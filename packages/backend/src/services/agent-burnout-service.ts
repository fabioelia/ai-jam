import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentBurnoutStatus {
  agentName: string;
  activeCount: number;
  avgStaleDays: number;
  storyPointLoad: number;
  riskLevel: 'critical' | 'high' | 'medium';
  overloaded: boolean;
  degrading: boolean;
  recommendation: string;
}

export interface BurnoutReport {
  projectId: string;
  atRiskAgents: AgentBurnoutStatus[];
  totalAgents: number;
  atRiskCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  analyzedAt: string;
}

const ACTIVE_STATUSES = new Set(['in_progress', 'review', 'qa']);
const FALLBACK_RECOMMENDATION = "Consider redistributing active tickets to reduce this agent's load";
const RISK_ORDER: Record<AgentBurnoutStatus['riskLevel'], number> = { critical: 0, high: 1, medium: 2 };

export async function detectBurnout(projectId: string): Promise<BurnoutReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
      storyPoints: tickets.storyPoints,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  type AgentData = {
    activeTickets: Array<{ title: string; updatedAt: Date; storyPoints: number | null }>;
  };

  const agentMap = new Map<string, AgentData>();

  for (const ticket of allTickets) {
    const persona = ticket.assignedPersona as string | null;
    if (!persona) continue;
    if (!agentMap.has(persona)) agentMap.set(persona, { activeTickets: [] });
    if (ACTIVE_STATUSES.has(ticket.status as string)) {
      agentMap.get(persona)!.activeTickets.push({
        title: ticket.title,
        updatedAt: ticket.updatedAt,
        storyPoints: ticket.storyPoints,
      });
    }
  }

  const totalAgents = agentMap.size;
  if (totalAgents === 0) {
    return {
      projectId,
      atRiskAgents: [],
      totalAgents: 0,
      atRiskCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      analyzedAt: new Date().toISOString(),
    };
  }

  const now = Date.now();

  type AgentStats = {
    agentName: string;
    activeCount: number;
    avgStaleDays: number;
    storyPointLoad: number;
    topTitles: string[];
  };

  const agentStats: AgentStats[] = [];

  for (const [agentName, data] of agentMap.entries()) {
    const activeCount = data.activeTickets.length;
    const staleDaysArr = data.activeTickets.map((t) =>
      Math.floor((now - new Date(t.updatedAt).getTime()) / 86400000),
    );
    const avgStaleDays =
      activeCount > 0 ? staleDaysArr.reduce((a, b) => a + b, 0) / activeCount : 0;
    const storyPointLoad = data.activeTickets.reduce(
      (sum, t) => sum + (t.storyPoints ?? 1),
      0,
    );
    const topTitles = data.activeTickets.slice(0, 2).map((t) => t.title);

    agentStats.push({ agentName, activeCount, avgStaleDays, storyPointLoad, topTitles });
  }

  const avgActiveCount =
    agentStats.reduce((s, a) => s + a.activeCount, 0) / agentStats.length;

  const atRiskRaw: Array<AgentStats & { overloaded: boolean; degrading: boolean; riskLevel: AgentBurnoutStatus['riskLevel'] }> = [];

  for (const stat of agentStats) {
    const overloaded = stat.activeCount > avgActiveCount * 1.5 && stat.activeCount >= 3;
    const degrading = stat.avgStaleDays > 4 && stat.activeCount >= 2;

    if (!overloaded && !degrading) continue;

    let riskLevel: AgentBurnoutStatus['riskLevel'];
    if (overloaded && degrading) {
      riskLevel = 'critical';
    } else if (overloaded || (degrading && stat.avgStaleDays > 7)) {
      riskLevel = 'high';
    } else {
      riskLevel = 'medium';
    }

    atRiskRaw.push({ ...stat, overloaded, degrading, riskLevel });
  }

  // Batch AI recommendations
  const recommendations = new Map<string, string>();
  if (atRiskRaw.length > 0) {
    try {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const agentLines = atRiskRaw
        .map(
          (a) =>
            `Agent: ${a.agentName}, activeCount: ${a.activeCount}, avgStaleDays: ${a.avgStaleDays.toFixed(1)}, storyPointLoad: ${a.storyPointLoad}, topTickets: ${a.topTitles.join(' | ')}`,
        )
        .join('\n');

      const prompt = `You are an AI workload analyst. For each agent below, provide one specific relief action recommendation (one sentence each). Output ONLY a JSON object mapping agentName to recommendation string. No other text.

${agentLines}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [name, rec] of Object.entries(parsed)) {
          recommendations.set(name, rec as string);
        }
      }
    } catch (e) {
      console.warn('Agent burnout AI recommendations failed, using fallback:', e);
    }
  }

  const atRiskAgents: AgentBurnoutStatus[] = atRiskRaw.map((a) => ({
    agentName: a.agentName,
    activeCount: a.activeCount,
    avgStaleDays: Math.round(a.avgStaleDays * 10) / 10,
    storyPointLoad: a.storyPointLoad,
    riskLevel: a.riskLevel,
    overloaded: a.overloaded,
    degrading: a.degrading,
    recommendation: recommendations.get(a.agentName) ?? FALLBACK_RECOMMENDATION,
  }));

  atRiskAgents.sort((a, b) => {
    const tierDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (tierDiff !== 0) return tierDiff;
    return b.activeCount - a.activeCount;
  });

  const criticalCount = atRiskAgents.filter((a) => a.riskLevel === 'critical').length;
  const highCount = atRiskAgents.filter((a) => a.riskLevel === 'high').length;
  const mediumCount = atRiskAgents.filter((a) => a.riskLevel === 'medium').length;

  return {
    projectId,
    atRiskAgents,
    totalAgents,
    atRiskCount: atRiskAgents.length,
    criticalCount,
    highCount,
    mediumCount,
    analyzedAt: new Date().toISOString(),
  };
}
