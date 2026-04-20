import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentGoalAlignment {
  agentPersona: string;
  tasksCompleted: number;
  tasksInScope: number;
  tasksOutOfScope: number;
  alignmentScore: number;
  driftRate: number;
  classification: 'aligned' | 'partial' | 'drifted';
}

export interface GoalAlignmentSummary {
  totalAgents: number;
  avgAlignmentScore: number;
  driftedAgents: number;
  mostAlignedAgent: string | null;
}

export interface GoalAlignmentReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentGoalAlignment[];
  summary: GoalAlignmentSummary;
  aiSummary: string;
}

const FALLBACK_SUMMARY = (avg: number, drifted: number) =>
  `Average alignment score: ${avg}%. ${drifted} agent(s) drifted from project goals.`;

function classify(score: number): 'aligned' | 'partial' | 'drifted' {
  if (score >= 80) return 'aligned';
  if (score >= 50) return 'partial';
  return 'drifted';
}

export async function analyzeGoalAlignment(projectId: string): Promise<GoalAlignmentReport> {
  const now = new Date();

  const doneTickets = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      epicId: tickets.epicId,
      featureId: tickets.featureId,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), eq(tickets.status, 'done')));

  if (doneTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgents: 0, avgAlignmentScore: 0, driftedAgents: 0, mostAlignedAgent: null },
      aiSummary: FALLBACK_SUMMARY(0, 0),
    };
  }

  // Group by assignedPersona
  const agentMap = new Map<string, { inScope: number; outOfScope: number }>();
  for (const t of doneTickets) {
    const persona = t.assignedPersona ?? 'Unassigned';
    if (!agentMap.has(persona)) agentMap.set(persona, { inScope: 0, outOfScope: 0 });
    const entry = agentMap.get(persona)!;
    if (t.epicId != null || t.featureId != null) {
      entry.inScope++;
    } else {
      entry.outOfScope++;
    }
  }

  const agents: AgentGoalAlignment[] = [];
  for (const [agentPersona, { inScope, outOfScope }] of agentMap.entries()) {
    const tasksCompleted = inScope + outOfScope;
    if (tasksCompleted < 1) continue;
    const alignmentScore = Math.round((inScope / tasksCompleted) * 100);
    const driftRate = Math.round((outOfScope / tasksCompleted) * 100) / 100;
    agents.push({
      agentPersona,
      tasksCompleted,
      tasksInScope: inScope,
      tasksOutOfScope: outOfScope,
      alignmentScore,
      driftRate,
      classification: classify(alignmentScore),
    });
  }

  agents.sort((a, b) =>
    b.alignmentScore !== a.alignmentScore
      ? b.alignmentScore - a.alignmentScore
      : b.tasksCompleted - a.tasksCompleted,
  );

  const totalAgents = agents.length;
  const avgAlignmentScore =
    totalAgents > 0 ? Math.round(agents.reduce((s, a) => s + a.alignmentScore, 0) / totalAgents) : 0;
  const driftedAgents = agents.filter((a) => a.alignmentScore < 50).length;
  const mostAlignedAgent = agents.length > 0 ? agents[0].agentPersona : null;

  const summary: GoalAlignmentSummary = { totalAgents, avgAlignmentScore, driftedAgents, mostAlignedAgent };

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY(avgAlignmentScore, driftedAgents);
  try {
    const agentLines = agents
      .slice(0, 5)
      .map((a) => `${a.agentPersona}: score=${a.alignmentScore}%, classification=${a.classification}, drift=${a.driftRate}`)
      .join('\n');
    const prompt = `Analyze agent goal alignment for project. Focus on: which agents work consistently within epic/feature scope, which agents frequently work on untracked tasks, whether drift indicates poor planning or scope creep, recommendations to improve goal alignment and reduce out-of-scope work.\n\nAgents:\n${agentLines}\n\nSummary: avg=${avgAlignmentScore}%, drifted=${driftedAgents}/${totalAgents}`;
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Goal alignment AI summary failed, using fallback:', e);
  }

  return { projectId, analyzedAt: now.toISOString(), agents, summary, aiSummary };
}
