import Anthropic from '@anthropic-ai/sdk';

export interface PriorityCoverage {
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface ComplexityCoverage {
  simple: number;
  standard: number;
  complex: number;
}

export interface AgentSkillMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  priorityCoverage: PriorityCoverage;
  complexityCoverage: ComplexityCoverage;
  coverageScore: number;
  coverageTier: 'versatile' | 'broad' | 'focused' | 'specialist';
  dominantPriority: string;
  dominantComplexity: string;
}

export interface AgentSkillCoverageReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgCoverageScore: number;
    fullCoverageCount: number;
    specializationCount: number;
    ticketCategoriesTotal: number;
  };
  agents: AgentSkillMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeCoverageScore(
  priorityCoverage: PriorityCoverage,
  complexityCoverage: ComplexityCoverage,
  totalTickets: number,
): number {
  const priorityTiers = Object.values(priorityCoverage).filter((v) => v > 0).length;
  const complexityTiers = Object.values(complexityCoverage).filter((v) => v > 0).length;
  const diversityBase = (priorityTiers / 4) * 50 + (complexityTiers / 3) * 50;
  const volumeBonus = totalTickets >= 20 ? 10 : totalTickets >= 10 ? 5 : 0;
  return Math.round(Math.min(100, Math.max(0, diversityBase + volumeBonus)));
}

export function getCoverageTier(
  score: number,
): 'versatile' | 'broad' | 'focused' | 'specialist' {
  if (score >= 80) return 'versatile';
  if (score >= 60) return 'broad';
  if (score >= 40) return 'focused';
  return 'specialist';
}

function getDominant<T extends Record<string, number>>(coverage: T): string {
  return Object.entries(coverage).reduce(
    (best, [k, v]) => (v > best[1] ? [k, v] : best),
    ['none', -1] as [string, number],
  )[0];
}

export async function analyzeAgentSkillCoverage(
  projectId: string,
): Promise<AgentSkillCoverageReport> {
  const mockAgents = [
    {
      name: 'Backend Developer',
      role: 'Backend Developer',
      priorityCoverage: { urgent: 8, high: 12, medium: 10, low: 4 },
      complexityCoverage: { simple: 6, standard: 15, complex: 13 },
    },
    {
      name: 'Frontend Developer',
      role: 'Frontend Developer',
      priorityCoverage: { urgent: 3, high: 10, medium: 14, low: 8 },
      complexityCoverage: { simple: 10, standard: 18, complex: 7 },
    },
    {
      name: 'QA Engineer',
      role: 'QA Engineer',
      priorityCoverage: { urgent: 2, high: 6, medium: 12, low: 0 },
      complexityCoverage: { simple: 8, standard: 10, complex: 2 },
    },
    {
      name: 'DevOps Engineer',
      role: 'DevOps Engineer',
      priorityCoverage: { urgent: 5, high: 7, medium: 0, low: 0 },
      complexityCoverage: { simple: 0, standard: 4, complex: 8 },
    },
    {
      name: 'Data Engineer',
      role: 'Data Engineer',
      priorityCoverage: { urgent: 0, high: 2, medium: 3, low: 0 },
      complexityCoverage: { simple: 0, standard: 2, complex: 3 },
    },
  ];

  const agents: AgentSkillMetrics[] = mockAgents.map((a, i) => {
    const totalTickets =
      Object.values(a.priorityCoverage).reduce((s, v) => s + v, 0);
    const coverageScore = computeCoverageScore(a.priorityCoverage, a.complexityCoverage, totalTickets);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalTickets,
      priorityCoverage: a.priorityCoverage,
      complexityCoverage: a.complexityCoverage,
      coverageScore,
      coverageTier: getCoverageTier(coverageScore),
      dominantPriority: getDominant(a.priorityCoverage),
      dominantComplexity: getDominant(a.complexityCoverage),
    };
  });

  agents.sort((a, b) => b.coverageScore - a.coverageScore);

  const avgCoverageScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.coverageScore, 0) / agents.length)
      : 0;
  const fullCoverageCount = agents.filter((a) => a.coverageTier === 'versatile').length;
  const specializationCount = agents.filter((a) => a.coverageTier === 'specialist').length;

  // Count distinct (priority, complexity) combos across all agents
  const combos = new Set<string>();
  for (const agent of agents) {
    for (const [pk, pv] of Object.entries(agent.priorityCoverage)) {
      if (pv > 0) {
        for (const [ck, cv] of Object.entries(agent.complexityCoverage)) {
          if (cv > 0) combos.add(`${pk}:${ck}`);
        }
      }
    }
  }
  const ticketCategoriesTotal = combos.size;

  let aiSummary = 'Skill coverage analysis complete.';
  let aiRecommendations: string[] = [
    'Cross-train specialist agents to handle a wider range of ticket priorities.',
    'Ensure critical and urgent tickets have coverage across complexity levels.',
    'Balance workload so versatile agents are not overloaded with all ticket types.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent skill coverage: ${agents.length} agents, avg coverage score ${avgCoverageScore}, ${fullCoverageCount} versatile, ${specializationCount} specialists. Provide a 2-sentence summary and 3 recommendations.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        const lines = text.split('\n').filter((l) => l.trim());
        aiSummary = lines[0] ?? aiSummary;
        aiRecommendations =
          lines.slice(1, 4).filter(Boolean).length > 0
            ? lines.slice(1, 4).filter(Boolean)
            : aiRecommendations;
      }
    }
  } catch (e) {
    console.warn('AI skill coverage analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgCoverageScore,
      fullCoverageCount,
      specializationCount,
      ticketCategoriesTotal,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
