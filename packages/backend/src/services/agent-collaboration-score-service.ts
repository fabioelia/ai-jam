import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentCollaborationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalCollaborations: number;
  successfulCollaborations: number;
  collaborationSuccessRate: number;
  avgContextQuality: number;
  avgHandoffCompleteness: number;
  collaborationScore: number;
  collaborationTier: 'synergistic' | 'collaborative' | 'functional' | 'isolated';
  topCollaborator: string | null;
}

export interface AgentCollaborationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgCollaborationScore: number;
    mostCollaborativeAgent: string;
    synergisticCount: number;
  };
  agents: AgentCollaborationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeCollaborationScore(
  successRate: number,
  avgContextQuality: number,
  avgHandoffCompleteness: number,
  totalCollaborations: number,
): number {
  let weighted = 0.6 * successRate + 0.2 * avgContextQuality + 0.2 * avgHandoffCompleteness;
  if (totalCollaborations >= 15) weighted += 5;
  if (totalCollaborations < 5) weighted -= 10;
  return Math.min(100, Math.max(0, Math.round(weighted)));
}

export function getCollaborationTier(score: number): AgentCollaborationMetrics['collaborationTier'] {
  if (score >= 80) return 'synergistic';
  if (score >= 60) return 'collaborative';
  if (score >= 40) return 'functional';
  return 'isolated';
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

export async function analyzeAgentCollaboration(projectId: string): Promise<AgentCollaborationReport> {
  const rows = await db
    .select({
      id: agentSessions.id,
      ticketId: agentSessions.ticketId,
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      outputSummary: agentSessions.outputSummary,
      retryCount: agentSessions.retryCount,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group sessions by ticketId
  const ticketAgentsMap = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.ticketId) continue;
    if (!ticketAgentsMap.has(row.ticketId)) ticketAgentsMap.set(row.ticketId, []);
    const agents = ticketAgentsMap.get(row.ticketId)!;
    if (!agents.includes(row.personaType)) agents.push(row.personaType);
  }

  // Per-agent data
  const agentMap = new Map<string, {
    sessions: typeof rows;
    collaboratingTickets: Map<string, string[]>;
    collaboratorCounts: Map<string, number>;
  }>();

  for (const row of rows) {
    if (!agentMap.has(row.personaType)) {
      agentMap.set(row.personaType, {
        sessions: [],
        collaboratingTickets: new Map(),
        collaboratorCounts: new Map(),
      });
    }
    agentMap.get(row.personaType)!.sessions.push(row);
  }

  for (const [ticketId, ticketAgents] of ticketAgentsMap.entries()) {
    if (ticketAgents.length < 2) continue;
    for (const agentId of ticketAgents) {
      const data = agentMap.get(agentId);
      if (!data) continue;
      const others = ticketAgents.filter(a => a !== agentId);
      data.collaboratingTickets.set(ticketId, others);
      for (const other of others) {
        data.collaboratorCounts.set(other, (data.collaboratorCounts.get(other) ?? 0) + 1);
      }
    }
  }

  const agents: AgentCollaborationMetrics[] = [];

  for (const [agentId, data] of agentMap.entries()) {
    const totalCollaborations = data.collaboratingTickets.size;
    const successfulCollaborations = [...data.collaboratingTickets.keys()].filter(ticketId => {
      return data.sessions.some(s => s.ticketId === ticketId && s.status === 'completed');
    }).length;

    const collaborationSuccessRate = totalCollaborations > 0
      ? Math.round((successfulCollaborations / totalCollaborations) * 100)
      : 50;

    const avgContextQuality = data.sessions.length > 0
      ? Math.round(data.sessions.reduce((sum, s) => {
          const len = s.outputSummary?.length ?? 0;
          return sum + Math.min(100, 20 + (len > 200 ? 50 : len > 100 ? 30 : len > 0 ? 15 : 0));
        }, 0) / data.sessions.length)
      : 50;

    const avgHandoffCompleteness = data.sessions.length > 0
      ? Math.round(data.sessions.reduce((sum, s) => {
          const base = s.status === 'completed' ? 80 : s.status === 'failed' ? 20 : 50;
          const retryPenalty = Math.min(30, (s.retryCount ?? 0) * 10);
          return sum + Math.max(0, base - retryPenalty);
        }, 0) / data.sessions.length)
      : 50;

    const collaborationScore = computeCollaborationScore(
      collaborationSuccessRate,
      avgContextQuality,
      avgHandoffCompleteness,
      totalCollaborations,
    );

    const collaborationTier = getCollaborationTier(collaborationScore);

    let topCollaborator: string | null = null;
    let maxCount = 0;
    for (const [collaborator, count] of data.collaboratorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        topCollaborator = collaborator;
      }
    }

    agents.push({
      agentId,
      agentName: agentId,
      agentRole: agentRoleFromPersona(agentId),
      totalCollaborations,
      successfulCollaborations,
      collaborationSuccessRate,
      avgContextQuality,
      avgHandoffCompleteness,
      collaborationScore,
      collaborationTier,
      topCollaborator,
    });
  }

  agents.sort((a, b) => b.collaborationScore - a.collaborationScore);

  const totalAgents = agents.length;
  const avgCollaborationScore = totalAgents > 0
    ? Math.round(agents.reduce((s, a) => s + a.collaborationScore, 0) / totalAgents)
    : 0;
  const mostCollaborativeAgent = agents.length > 0 ? agents[0].agentName : '';
  const synergisticCount = agents.filter(a => a.collaborationTier === 'synergistic').length;

  let aiSummary = `Analyzed ${totalAgents} agents with avg collaboration score of ${avgCollaborationScore}.`;
  let aiRecommendations = [
    'Increase cross-agent ticket assignments to improve collaboration scores.',
    'Ensure agents provide detailed output summaries for better context quality.',
  ];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummaryText = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.collaborationScore}, tier=${a.collaborationTier}, successRate=${a.collaborationSuccessRate}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze agent collaboration scores:\n${agentSummaryText}\nProvide JSON: {"aiSummary": "...", "aiRecommendations": ["...", "..."]}`,
      }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (typeof parsed.aiSummary === 'string' && parsed.aiSummary) aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.aiRecommendations) && parsed.aiRecommendations.length > 0) aiRecommendations = parsed.aiRecommendations;
    }
  } catch {
    // use defaults
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: { totalAgents, avgCollaborationScore, mostCollaborativeAgent, synergisticCount },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
