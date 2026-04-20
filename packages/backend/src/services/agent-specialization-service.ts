import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentSpecializationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasks: number;
  inDomainTasks: number;
  outOfDomainTasks: number;
  inDomainRate: number;
  specializationScore: number;
  topInDomainCategory: string;
  topOutOfDomainCategory: string;
  specializationTier: 'highly-specialized' | 'focused' | 'generalist' | 'unfocused';
}

export interface AgentSpecializationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgSpecializationScore: number;
    mostSpecializedAgent: string;
    mostUnfocusedAgent: string;
    highlySpecializedCount: number;
  };
  agents: AgentSpecializationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSpecializationScore(inDomainRate: number, totalTasks: number): number {
  let score = inDomainRate;
  if (totalTasks >= 20) score += 5;
  if (totalTasks < 5) score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getSpecializationTier(score: number): AgentSpecializationMetrics['specializationTier'] {
  if (score >= 80) return 'highly-specialized';
  if (score >= 60) return 'focused';
  if (score >= 40) return 'generalist';
  return 'unfocused';
}

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  labels: string[] | null;
};

function agentNameFromPersona(persona: string): string {
  return persona
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function analyzeAgentSpecialization(projectId: string): Promise<AgentSpecializationReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      labels: (tickets as any).labels,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (projectTickets.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: { totalAgents: 0, avgSpecializationScore: 0, mostSpecializedAgent: '', mostUnfocusedAgent: '', highlySpecializedCount: 0 },
      agents: [],
      aiSummary: '',
      aiRecommendations: [],
    };
  }

  const ticketsByAgent = new Map<string, TicketRow[]>();
  for (const t of projectTickets) {
    if (!t.assignedPersona) continue;
    const list = ticketsByAgent.get(t.assignedPersona) ?? [];
    list.push(t);
    ticketsByAgent.set(t.assignedPersona, list);
  }

  const agents: AgentSpecializationMetrics[] = [];

  for (const [personaId, agentTickets] of ticketsByAgent.entries()) {
    const totalTasks = agentTickets.length;

    // Count label frequencies
    const labelCounts = new Map<string, number>();
    for (const t of agentTickets) {
      const lbls: string[] = Array.isArray(t.labels) ? t.labels : [];
      for (const lbl of lbls) {
        if (lbl) labelCounts.set(lbl, (labelCounts.get(lbl) ?? 0) + 1);
      }
    }

    // Primary domain = most common label
    let topLabel = '';
    let topCount = 0;
    for (const [lbl, cnt] of labelCounts.entries()) {
      if (cnt > topCount) { topLabel = lbl; topCount = cnt; }
    }

    const inDomainTickets = topLabel
      ? agentTickets.filter(t => Array.isArray(t.labels) && t.labels.includes(topLabel))
      : [];
    const outOfDomainTickets = agentTickets.filter(t => !inDomainTickets.includes(t));

    const inDomainTasks = inDomainTickets.length;
    const outOfDomainTasks = outOfDomainTickets.length;
    const inDomainRate = totalTasks > 0 ? Math.round((inDomainTasks / totalTasks) * 10000) / 100 : 0;

    // Top out-of-domain category
    const outLabelCounts = new Map<string, number>();
    for (const t of outOfDomainTickets) {
      const lbls: string[] = Array.isArray(t.labels) ? t.labels : [];
      for (const lbl of lbls) {
        if (lbl && lbl !== topLabel) outLabelCounts.set(lbl, (outLabelCounts.get(lbl) ?? 0) + 1);
      }
    }
    let topOutLabel = '';
    let topOutCount = 0;
    for (const [lbl, cnt] of outLabelCounts.entries()) {
      if (cnt > topOutCount) { topOutLabel = lbl; topOutCount = cnt; }
    }

    const specializationScore = computeSpecializationScore(inDomainRate, totalTasks);
    const specializationTier = getSpecializationTier(specializationScore);

    agents.push({
      agentId: personaId,
      agentName: agentNameFromPersona(personaId),
      agentRole: topLabel ? topLabel : agentNameFromPersona(personaId),
      totalTasks,
      inDomainTasks,
      outOfDomainTasks,
      inDomainRate,
      specializationScore,
      topInDomainCategory: topLabel || 'general',
      topOutOfDomainCategory: topOutLabel || 'none',
      specializationTier,
    });
  }

  agents.sort((a, b) => b.specializationScore - a.specializationScore);

  const avgSpecializationScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.specializationScore, 0) / agents.length)
    : 0;
  const mostSpecializedAgent = agents.length > 0 ? agents[0].agentName : '';
  const mostUnfocusedAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const highlySpecializedCount = agents.filter(a => a.specializationTier === 'highly-specialized').length;

  let aiSummary = '';
  let aiRecommendations: string[] = [];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.specializationScore}, tier=${a.specializationTier}, inDomainRate=${a.inDomainRate}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Analyze agent specialization:\n${agentSummary}\nProvide JSON: {"aiSummary": "...", "aiRecommendations": ["..."]}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (typeof parsed.aiSummary === 'string') aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.aiRecommendations)) aiRecommendations = parsed.aiRecommendations;
    }
  } catch {
    aiSummary = 'Specialization analysis complete.';
    aiRecommendations = ['Assign in-domain tasks to highly-specialized agents for best results.'];
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: { totalAgents: agents.length, avgSpecializationScore, mostSpecializedAgent, mostUnfocusedAgent, highlySpecializedCount },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
