import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentQueueProfile {
  agentPersona: string;
  queueDepth: number;
  criticalQueued: number;
  highQueued: number;
  activeTickets: number;
  totalLoad: number;
  overflowRisk: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface QueueDepthReport {
  projectId: string;
  agentProfiles: AgentQueueProfile[];
  totalAgents: number;
  overloadedAgents: number;
  idleAgents: number;
  avgQueueDepth: number;
  generatedAt: string;
}

const QUEUE_STATUSES = ['backlog'] as const;
const ACTIVE_STATUSES = ['in_progress', 'review', 'qa', 'acceptance'] as const;

function computeOverflowRisk(queueDepth: number): 'low' | 'medium' | 'high' {
  if (queueDepth > 6) return 'high';
  if (queueDepth >= 3) return 'medium';
  return 'low';
}

function fallbackRec(risk: 'low' | 'medium' | 'high'): string {
  if (risk === 'high') return 'Reassign lower-priority tickets to reduce queue depth';
  if (risk === 'medium') return 'Monitor queue — consider redistributing if new tickets arrive';
  return 'Queue depth healthy';
}

export async function monitorQueueDepths(projectId: string): Promise<QueueDepthReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      priority: tickets.priority,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const assignedTickets = allTickets.filter((t) => t.assignedPersona != null);

  const agentMap = new Map<string, typeof assignedTickets>();
  for (const t of assignedTickets) {
    const persona = t.assignedPersona as string;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t);
  }

  const profileData: Array<Omit<AgentQueueProfile, 'recommendation'>> = [];

  for (const [persona, ts] of agentMap.entries()) {
    const queued = ts.filter((t) => QUEUE_STATUSES.includes(t.status as typeof QUEUE_STATUSES[number]));
    const active = ts.filter((t) => ACTIVE_STATUSES.includes(t.status as typeof ACTIVE_STATUSES[number]));

    const queueDepth = queued.length;
    const activeTickets = active.length;
    const totalLoad = queueDepth + activeTickets;
    const criticalQueued = queued.filter((t) => t.priority === 'critical').length;
    const highQueued = queued.filter((t) => t.priority === 'high').length;
    const overflowRisk = computeOverflowRisk(queueDepth);

    profileData.push({ agentPersona: persona, queueDepth, criticalQueued, highQueued, activeTickets, totalLoad, overflowRisk });
  }

  // Sort: high risk first, then by totalLoad desc
  profileData.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const riskDiff = riskOrder[a.overflowRisk] - riskOrder[b.overflowRisk];
    if (riskDiff !== 0) return riskDiff;
    return b.totalLoad - a.totalLoad;
  });

  // AI recs for high-risk agents (max 3)
  const highRiskAgents = profileData.filter((a) => a.overflowRisk === 'high').slice(0, 3);
  const recommendationMap = new Map<string, string>();

  if (highRiskAgents.length > 0) {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    try {
      const desc = highRiskAgents
        .map(
          (a) =>
            `Agent: ${a.agentPersona}, QueueDepth: ${a.queueDepth}, CriticalQueued: ${a.criticalQueued}, HighQueued: ${a.highQueued}, ActiveTickets: ${a.activeTickets}`,
        )
        .join('\n');

      const prompt = `For each overloaded agent below, write exactly one sentence recommending how to reduce queue depth. Output as JSON array [{agent, recommendation}].\n\n${desc}`;

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
      console.warn('Queue depth monitor AI failed, using fallback:', e);
    }
  }

  const agentProfiles: AgentQueueProfile[] = profileData.map((a) => ({
    ...a,
    recommendation: recommendationMap.get(a.agentPersona) ?? fallbackRec(a.overflowRisk),
  }));

  const totalAgents = agentProfiles.length;
  const overloadedAgents = agentProfiles.filter((a) => a.overflowRisk === 'high').length;
  const idleAgents = agentProfiles.filter((a) => a.queueDepth === 0 && a.activeTickets === 0).length;
  const avgQueueDepth =
    totalAgents === 0 ? 0 : agentProfiles.reduce((sum, a) => sum + a.queueDepth, 0) / totalAgents;

  return {
    projectId,
    agentProfiles,
    totalAgents,
    overloadedAgents,
    idleAgents,
    avgQueueDepth: Math.round(avgQueueDepth * 10) / 10,
    generatedAt: now.toISOString(),
  };
}
