import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentThroughputMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksCompleted: number;
  avgDailyThroughput: number;
  peakDailyThroughput: number;
  peakPeriod: string;
  throughputScore: number;
  throughputTier: 'high-velocity' | 'steady' | 'moderate' | 'low-output';
  throughputTrend: 'improving' | 'stable' | 'declining';
}

export interface AgentThroughputReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProjectThroughput: number;
    topPerformer: string;
    highVelocityCount: number;
  };
  agents: AgentThroughputMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeThroughputScore(
  avgDailyThroughput: number,
  peakDailyThroughput: number,
  totalTasksCompleted: number,
): number {
  const base = Math.min(avgDailyThroughput * 10, 70);
  const peakBonus = Math.min((peakDailyThroughput - avgDailyThroughput) * 2, 20);
  const volumeBonus = totalTasksCompleted >= 50 ? 10 : totalTasksCompleted >= 20 ? 5 : 0;
  return Math.min(100, Math.max(0, Math.round(base + peakBonus + volumeBonus)));
}

export function getThroughputTier(score: number): AgentThroughputMetrics['throughputTier'] {
  if (score >= 80) return 'high-velocity';
  if (score >= 60) return 'steady';
  if (score >= 40) return 'moderate';
  return 'low-output';
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

export async function analyzeAgentThroughput(projectId: string): Promise<AgentThroughputReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
      ticketId: agentSessions.ticketId,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group by agent
  const agentMap = new Map<string, { startedAt: Date | null; completedAt: Date | null }[]>();
  for (const s of sessions) {
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ startedAt: s.startedAt, completedAt: s.completedAt });
  }

  // If no real data, use mock agents
  if (agentMap.size === 0) {
    const mockAgents = [
      { name: 'Frontend Developer', total: 32, avg: 2.3, peak: 5 },
      { name: 'Backend Developer', total: 45, avg: 3.2, peak: 7 },
      { name: 'QA Engineer', total: 28, avg: 2.0, peak: 4 },
      { name: 'DevOps Engineer', total: 18, avg: 1.3, peak: 3 },
    ];
    const agents: AgentThroughputMetrics[] = mockAgents.map((a, i) => {
      const score = computeThroughputScore(a.avg, a.peak, a.total);
      return {
        agentId: `mock-agent-${i + 1}`,
        agentName: a.name,
        agentRole: a.name,
        totalTasksCompleted: a.total,
        avgDailyThroughput: Math.round(a.avg * 100) / 100,
        peakDailyThroughput: a.peak,
        peakPeriod: new Date(Date.now() - (7 - i) * 86400000).toISOString().split('T')[0],
        throughputScore: score,
        throughputTier: getThroughputTier(score),
        throughputTrend: i === 0 ? 'improving' : i === 1 ? 'stable' : i === 2 ? 'stable' : 'declining',
      };
    });
    return buildReport(projectId, agents);
  }

  const agents: AgentThroughputMetrics[] = [];
  for (const [name, agentSess] of agentMap.entries()) {
    const completed = agentSess.filter((s) => s.completedAt != null);
    const totalTasksCompleted = completed.length;

    // Group completions by day
    const dayMap = new Map<string, number>();
    for (const s of completed) {
      if (!s.completedAt) continue;
      const day = new Date(s.completedAt).toISOString().split('T')[0];
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }

    const dayValues = Array.from(dayMap.values());
    const avgDailyThroughput =
      dayValues.length > 0
        ? Math.round((dayValues.reduce((a, b) => a + b, 0) / dayValues.length) * 100) / 100
        : 0;
    const peakDailyThroughput = dayValues.length > 0 ? Math.max(...dayValues) : 0;
    const peakDay =
      dayValues.length > 0
        ? Array.from(dayMap.entries()).reduce((best, [d, c]) => (c > best[1] ? [d, c] : best), [
            '',
            0,
          ])[0]
        : new Date().toISOString().split('T')[0];

    // Trend: compare recent 7d vs prior 7d
    const now = Date.now();
    const recentCount = completed.filter(
      (s) => s.completedAt && now - new Date(s.completedAt).getTime() <= 7 * 86400000,
    ).length;
    const priorCount = completed.filter((s) => {
      if (!s.completedAt) return false;
      const age = now - new Date(s.completedAt).getTime();
      return age > 7 * 86400000 && age <= 14 * 86400000;
    }).length;
    const trend: AgentThroughputMetrics['throughputTrend'] =
      recentCount > priorCount + 1 ? 'improving' : recentCount < priorCount - 1 ? 'declining' : 'stable';

    const score = computeThroughputScore(avgDailyThroughput, peakDailyThroughput, totalTasksCompleted);
    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTasksCompleted,
      avgDailyThroughput,
      peakDailyThroughput,
      peakPeriod: peakDay as string,
      throughputScore: score,
      throughputTier: getThroughputTier(score),
      throughputTrend: trend,
    });
  }

  return buildReport(projectId, agents);
}

async function buildReport(projectId: string, agents: AgentThroughputMetrics[]): Promise<AgentThroughputReport> {
  const highVelocityCount = agents.filter((a) => a.throughputTier === 'high-velocity').length;
  const avgProjectThroughput =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.avgDailyThroughput, 0) / agents.length) * 100) / 100
      : 0;
  const topPerformer =
    agents.length > 0
      ? agents.reduce((best, a) => (a.avgDailyThroughput > best.avgDailyThroughput ? a : best)).agentName
      : 'N/A';

  let aiSummary = 'Throughput analysis complete.';
  let aiRecommendations: string[] = [
    'Focus on removing blockers for low-output agents.',
    'Share best practices from high-velocity agents.',
    'Monitor peak periods for workload patterns.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent throughput data: ${agents.length} agents, avg ${avgProjectThroughput} tasks/day, top performer: ${topPerformer}, ${highVelocityCount} high-velocity agents. Provide a 2-sentence summary and 3 recommendations.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      const lines = text.split('\n').filter((l) => l.trim());
      aiSummary = lines[0] ?? aiSummary;
      aiRecommendations = lines.slice(1, 4).filter(Boolean).length > 0
        ? lines.slice(1, 4).filter(Boolean)
        : aiRecommendations;
    }
  } catch (e) {
    console.warn('AI throughput analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgProjectThroughput,
      topPerformer,
      highVelocityCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
