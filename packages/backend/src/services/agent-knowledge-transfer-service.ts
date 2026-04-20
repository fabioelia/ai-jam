import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentKnowledgeTransferMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  sessionsWithHandoffNotes: number;
  knowledgeTransferRate: number;
  avgHandoffNoteLength: number;
  receivedKnowledgeCount: number;
  knowledgeRetentionScore: number;
  transferEfficiencyTier: 'excellent' | 'good' | 'adequate' | 'poor';
}

export interface AgentKnowledgeTransferReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgKnowledgeTransferRate: number;
    topTransferAgent: string;
    lowestTransferAgent: string;
    knowledgeLossRiskCount: number;
  };
  agents: AgentKnowledgeTransferMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

export function computeKnowledgeRetentionScore(
  knowledgeTransferRate: number,
  avgHandoffNoteLength: number,
  receivedKnowledgeCount: number,
): number {
  let score = knowledgeTransferRate * 0.5;
  if (avgHandoffNoteLength > 200) score += 20;
  else if (avgHandoffNoteLength > 100) score += 10;
  if (receivedKnowledgeCount > 0) score += 10;
  if (knowledgeTransferRate < 20) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export function getTransferEfficiencyTier(
  score: number,
): 'excellent' | 'good' | 'adequate' | 'poor' {
  if (score >= 75) return 'excellent';
  if (score >= 50) return 'good';
  if (score >= 25) return 'adequate';
  return 'poor';
}

export async function analyzeAgentKnowledgeTransfer(
  projectId: string,
): Promise<AgentKnowledgeTransferReport> {
  const generatedAt = new Date().toISOString();

  const emptyReport: AgentKnowledgeTransferReport = {
    projectId,
    generatedAt,
    summary: {
      totalAgents: 0,
      avgKnowledgeTransferRate: 0,
      topTransferAgent: '',
      lowestTransferAgent: '',
      knowledgeLossRiskCount: 0,
    },
    agents: [],
    insights: ['No agent sessions found for this project.'],
    recommendations: [],
  };

  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  if (ticketIds.length === 0) return emptyReport;

  const sessionRows = await db
    .select()
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) return emptyReport;

  // Group sessions by personaType
  const agentMap = new Map<
    string,
    {
      totalSessions: number;
      withNotes: number;
      totalNoteLength: number;
      receivedCount: number;
    }
  >();

  for (const s of sessionRows) {
    const id = s.personaType;
    if (!agentMap.has(id)) {
      agentMap.set(id, { totalSessions: 0, withNotes: 0, totalNoteLength: 0, receivedCount: 0 });
    }
    const e = agentMap.get(id)!;
    e.totalSessions += 1;

    // Use outputSummary as the notes proxy (no handoffNotes in schema)
    const notes = s.outputSummary ?? '';
    if (notes.length > 0) {
      e.withNotes += 1;
      e.totalNoteLength += notes.length;
    }

    // receivedKnowledgeCount: sessions where outputSummary includes 'from', 'received', or 'continuing'
    if (notes && /\b(from|received|continuing)\b/i.test(notes)) {
      e.receivedCount += 1;
    }
  }

  const agents: AgentKnowledgeTransferMetrics[] = [];

  for (const [personaType, d] of agentMap.entries()) {
    const knowledgeTransferRate =
      d.totalSessions > 0 ? (d.withNotes / d.totalSessions) * 100 : 0;
    const avgHandoffNoteLength =
      d.withNotes > 0 ? Math.round(d.totalNoteLength / d.withNotes) : 0;
    const knowledgeRetentionScore = computeKnowledgeRetentionScore(
      knowledgeTransferRate,
      avgHandoffNoteLength,
      d.receivedCount,
    );

    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalSessions: d.totalSessions,
      sessionsWithHandoffNotes: d.withNotes,
      knowledgeTransferRate: Math.round(knowledgeTransferRate * 10) / 10,
      avgHandoffNoteLength,
      receivedKnowledgeCount: d.receivedCount,
      knowledgeRetentionScore,
      transferEfficiencyTier: getTransferEfficiencyTier(knowledgeRetentionScore),
    });
  }

  agents.sort((a, b) => b.knowledgeRetentionScore - a.knowledgeRetentionScore);

  const avgKnowledgeTransferRate =
    agents.length > 0
      ? Math.round(
          (agents.reduce((sum, a) => sum + a.knowledgeTransferRate, 0) / agents.length) * 10,
        ) / 10
      : 0;

  const knowledgeLossRiskCount = agents.filter((a) => a.knowledgeTransferRate < 30).length;
  const topTransferAgent = agents.length > 0 ? agents[0].agentName : '';
  const lowestTransferAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';

  const insights: string[] = [
    `${agents.length} agent(s) analyzed. Average knowledge transfer rate: ${avgKnowledgeTransferRate}%.`,
  ];
  if (knowledgeLossRiskCount > 0) {
    insights.push(
      `${knowledgeLossRiskCount} agent(s) at knowledge loss risk (transfer rate < 30%).`,
    );
  }

  const recommendations: string[] = [];
  if (avgKnowledgeTransferRate < 50) {
    recommendations.push(
      'Knowledge transfer rate is low. Encourage agents to document output summaries for every session.',
    );
  } else {
    recommendations.push(
      'Knowledge transfer is healthy. Continue requiring output summaries for completed sessions.',
    );
  }

  // Optional OpenRouter AI summary with graceful fallback
  let aiSummary: string | undefined;
  let aiRecommendations: string[] | undefined;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.agentName}: tier=${a.transferEfficiencyTier}, transferRate=${a.knowledgeTransferRate}%, retentionScore=${a.knowledgeRetentionScore}`,
      )
      .join('\n');

    const prompt = `Analyze this agent knowledge transfer efficiency data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall knowledge transfer health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Knowledge transfer AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt,
    summary: {
      totalAgents: agents.length,
      avgKnowledgeTransferRate,
      topTransferAgent,
      lowestTransferAgent,
      knowledgeLossRiskCount,
    },
    agents,
    insights,
    recommendations,
    aiSummary,
    aiRecommendations,
  };
}
