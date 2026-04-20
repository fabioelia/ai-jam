import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentOutputConsistencyData {
  agentId: string;
  agentName: string;
  taskGroupsAnalyzed: number;
  avgOutputLength: number;
  outputLengthVariance: number;
  formatConsistencyRate: number;
  completionPhraseConsistency: number;
  consistencyScore: number;
  consistencyTier: 'stable' | 'mostly-stable' | 'variable' | 'erratic';
}

export interface AgentOutputConsistencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTaskGroups: number;
    avgConsistencyScore: number;
    mostConsistentAgent: string;
    highVarianceAgents: number;
  };
  agents: AgentOutputConsistencyData[];
  insights: string[];
  recommendations: string[];
}

export function computeConsistencyScore(formatConsistencyRate: number, outputLengthVariance: number): number {
  let base = formatConsistencyRate;
  if (outputLengthVariance < 100 && formatConsistencyRate >= 80) base += 10;
  if (outputLengthVariance > 500) base -= 15;
  return Math.max(0, Math.min(100, base));
}

export function computeConsistencyTier(score: number): AgentOutputConsistencyData['consistencyTier'] {
  if (score >= 85) return 'stable';
  if (score >= 65) return 'mostly-stable';
  if (score >= 40) return 'variable';
  return 'erratic';
}

export async function analyzeAgentOutputConsistency(projectId: string, sessions: any[]): Promise<AgentOutputConsistencyReport> {
  const generatedAt = new Date().toISOString();

  // Group sessions by personaType
  const byPersona = new Map<string, any[]>();
  for (const s of sessions) {
    const list = byPersona.get(s.personaType) ?? [];
    list.push(s);
    byPersona.set(s.personaType, list);
  }

  const agents: AgentOutputConsistencyData[] = [];

  for (const [personaType, agentSessions] of byPersona.entries()) {
    const taskGroupsAnalyzed = agentSessions.length;

    const outputLengths = agentSessions
      .filter((s: any) => s.outputSummary != null)
      .map((s: any) => (s.outputSummary as string).length);

    const avgOutputLength = outputLengths.length > 0
      ? Math.round(outputLengths.reduce((a: number, b: number) => a + b, 0) / outputLengths.length)
      : 0;

    const variance = outputLengths.length > 1
      ? Math.round(outputLengths.reduce((sum: number, l: number) => sum + Math.pow(l - avgOutputLength, 2), 0) / outputLengths.length)
      : 0;

    const completedCount = agentSessions.filter((s: any) => s.status === 'completed').length;
    const formatConsistencyRate = taskGroupsAnalyzed > 0
      ? Math.round((completedCount / taskGroupsAnalyzed) * 100)
      : 0;

    const withOutput = agentSessions.filter((s: any) => s.outputSummary != null && (s.outputSummary as string).trim() !== '').length;
    const completionPhraseConsistency = taskGroupsAnalyzed > 0
      ? Math.round((withOutput / taskGroupsAnalyzed) * 100)
      : 0;

    const consistencyScore = computeConsistencyScore(formatConsistencyRate, variance);
    const agentName = personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' ');

    agents.push({
      agentId: personaType,
      agentName,
      taskGroupsAnalyzed,
      avgOutputLength,
      outputLengthVariance: variance,
      formatConsistencyRate,
      completionPhraseConsistency,
      consistencyScore,
      consistencyTier: computeConsistencyTier(consistencyScore),
    });
  }

  agents.sort((a, b) => b.consistencyScore - a.consistencyScore);

  const highVarianceAgents = agents.filter(a => a.outputLengthVariance > 500).length;
  const avgConsistencyScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.consistencyScore, 0) / agents.length)
    : 0;
  const mostConsistentAgent = agents.length > 0 ? agents[0].agentName : '';

  const summary = {
    totalAgents: agents.length,
    totalTaskGroups: sessions.length,
    avgConsistencyScore,
    mostConsistentAgent,
    highVarianceAgents,
  };

  const insights: string[] = [];
  const recommendations: string[] = [];

  if (agents.length > 0) {
    insights.push(`${agents.length} agents analyzed across ${sessions.length} sessions.`);
    if (highVarianceAgents > 0) {
      insights.push(`${highVarianceAgents} agent(s) show high output length variance (>500).`);
    }
    recommendations.push('Establish output format templates for agents with erratic or variable tiers.');
    recommendations.push('Review task specifications for high-variance agents to improve consistency.');
  }

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummaryText = agents.slice(0, 8).map(a =>
      `${a.agentId}: score=${a.consistencyScore}, tier=${a.consistencyTier}, formatRate=${a.formatConsistencyRate}%, variance=${a.outputLengthVariance}`
    ).join('\n');

    const prompt = `Analyze AI agent output consistency:\n${agentSummaryText}\n\nProvide JSON: {"insights": ["..."], "recommendations": ["...", "..."]}`;

    const msg = await client.messages.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      try {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.insights) && parsed.insights.length > 0) insights.splice(0, insights.length, ...parsed.insights);
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations.splice(0, recommendations.length, ...parsed.recommendations);
      } catch { /* use defaults */ }
    }
  } catch { /* use defaults */ }

  return { projectId, generatedAt, summary, agents, insights, recommendations };
}
