import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentLoadForecast {
  agentType: string;
  currentLoad: number;
  predictedLoad: number;
  capacityUtilization: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface LoadPredictionReport {
  projectId: string;
  forecastWindow: string;
  totalTicketsPipeline: number;
  overloadedAgents: number;
  agentForecasts: AgentLoadForecast[];
  bottleneckWarnings: string[];
  aiInsight: string;
  analyzedAt: string;
}

const VELOCITY_FACTOR = 0.3;
const MAX_CONCURRENT = 5;
const FALLBACK_INSIGHT = 'Review agent assignments to balance workload across team.';

function computeRiskLevel(utilization: number): AgentLoadForecast['riskLevel'] {
  if (utilization >= 90) return 'critical';
  if (utilization >= 70) return 'high';
  if (utilization >= 50) return 'moderate';
  return 'low';
}

function computeRecommendation(riskLevel: AgentLoadForecast['riskLevel'], agentType: string): string {
  switch (riskLevel) {
    case 'critical': return `${agentType} is critically overloaded — reassign tickets immediately.`;
    case 'high': return `${agentType} load is high — consider redistributing upcoming work.`;
    case 'moderate': return `${agentType} load is moderate — monitor closely next cycle.`;
    default: return `${agentType} has capacity available — good candidate for new tickets.`;
  }
}

export async function predictLoad(projectId: string): Promise<LoadPredictionReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const pipeline = allTickets.filter(
    (t) => t.assignedPersona != null && (t.status === 'backlog' || t.status === 'in_progress'),
  );

  if (pipeline.length === 0) {
    return {
      projectId,
      forecastWindow: 'next 7 days',
      totalTicketsPipeline: 0,
      overloadedAgents: 0,
      agentForecasts: [],
      bottleneckWarnings: [],
      aiInsight: FALLBACK_INSIGHT,
      analyzedAt: new Date().toISOString(),
    };
  }

  const agentInProgress = new Map<string, number>();
  const agentBacklog = new Map<string, number>();

  for (const t of pipeline) {
    const persona = t.assignedPersona as string;
    if (t.status === 'in_progress') {
      agentInProgress.set(persona, (agentInProgress.get(persona) ?? 0) + 1);
    } else {
      agentBacklog.set(persona, (agentBacklog.get(persona) ?? 0) + 1);
    }
  }

  const allAgents = new Set([...agentInProgress.keys(), ...agentBacklog.keys()]);

  const agentForecasts: AgentLoadForecast[] = [];
  for (const agentType of allAgents) {
    const currentLoad = agentInProgress.get(agentType) ?? 0;
    const backlogCount = agentBacklog.get(agentType) ?? 0;
    const predictedLoad = Math.round(currentLoad + backlogCount * VELOCITY_FACTOR);
    const capacityUtilization = (predictedLoad / MAX_CONCURRENT) * 100;
    const riskLevel = computeRiskLevel(capacityUtilization);
    agentForecasts.push({
      agentType,
      currentLoad,
      predictedLoad,
      capacityUtilization,
      riskLevel,
      recommendation: computeRecommendation(riskLevel, agentType),
    });
  }

  agentForecasts.sort((a, b) => {
    const order = { critical: 0, high: 1, moderate: 2, low: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });

  const bottleneckWarnings = agentForecasts
    .filter((f) => f.riskLevel === 'critical' || f.riskLevel === 'high')
    .map((f) => `${f.agentType}: ${f.capacityUtilization.toFixed(0)}% capacity utilization (${f.riskLevel})`);

  const overloadedAgents = bottleneckWarnings.length;

  let aiInsight = FALLBACK_INSIGHT;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentForecasts
      .map(
        (f) =>
          `Agent: ${f.agentType}, CurrentLoad: ${f.currentLoad}, PredictedLoad: ${f.predictedLoad}, Utilization: ${f.capacityUtilization.toFixed(0)}%, Risk: ${f.riskLevel}`,
      )
      .join('\n');

    const prompt = `Analyze this agent load forecast and write a single paragraph (2-3 sentences) about overall workload distribution and the top recommendation. Be concise and actionable.\n\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) aiInsight = content;
  } catch (e) {
    console.warn('Agent load predictor AI insight failed, using fallback:', e);
  }

  return {
    projectId,
    forecastWindow: 'next 7 days',
    totalTicketsPipeline: pipeline.length,
    overloadedAgents,
    agentForecasts,
    bottleneckWarnings,
    aiInsight,
    analyzedAt: new Date().toISOString(),
  };
}
