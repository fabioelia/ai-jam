import Anthropic from '@anthropic-ai/sdk';

export interface AgentCollaborationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  handoffsSent: number;
  handoffsReceived: number;
  totalHandoffs: number;
  uniqueCollaborators: number;
  collaborationScore: number;
  collaborationTier: 'hub' | 'collaborative' | 'contributing' | 'isolated';
  isHub: boolean;
  isIsolated: boolean;
}

export interface AgentCollaborationNetworkReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalHandoffs: number;
    avgCollaborationScore: number;
    hubCount: number;
    isolatedCount: number;
    topHandoffPair: { fromAgent: string; toAgent: string; count: number } | null;
  };
  agents: AgentCollaborationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeCollaborationScore(
  handoffsSent: number,
  handoffsReceived: number,
  uniqueCollaborators: number,
  totalAgents: number,
): number {
  const sentComponent = Math.min(30, Math.max(0, handoffsSent * 5));
  const receivedComponent = Math.min(30, Math.max(0, handoffsReceived * 5));
  const diversityComponent =
    totalAgents > 1
      ? Math.min(40, Math.max(0, (uniqueCollaborators / (totalAgents - 1)) * 40))
      : 0;
  return Math.round(Math.min(100, Math.max(0, sentComponent + receivedComponent + diversityComponent)));
}

export function getCollaborationTier(
  score: number,
): 'hub' | 'collaborative' | 'contributing' | 'isolated' {
  if (score >= 75) return 'hub';
  if (score >= 50) return 'collaborative';
  if (score >= 25) return 'contributing';
  return 'isolated';
}

interface MockAgentSession {
  agentName: string;
  agentRole: string;
  handoffsSent: number;
  handoffsReceived: number;
  uniqueCollaborators: number;
}

export async function analyzeAgentCollaborationNetwork(
  projectId: string,
): Promise<AgentCollaborationNetworkReport> {
  const mockAgents: MockAgentSession[] = [
    { agentName: 'Backend Developer', agentRole: 'Backend Developer', handoffsSent: 6, handoffsReceived: 8, uniqueCollaborators: 3 },
    { agentName: 'Frontend Developer', agentRole: 'Frontend Developer', handoffsSent: 5, handoffsReceived: 4, uniqueCollaborators: 3 },
    { agentName: 'QA Engineer', agentRole: 'QA Engineer', handoffsSent: 3, handoffsReceived: 5, uniqueCollaborators: 2 },
    { agentName: 'DevOps Engineer', agentRole: 'DevOps Engineer', handoffsSent: 2, handoffsReceived: 1, uniqueCollaborators: 2 },
    { agentName: 'Data Engineer', agentRole: 'Data Engineer', handoffsSent: 0, handoffsReceived: 0, uniqueCollaborators: 0 },
  ];

  const totalAgents = mockAgents.length;

  const agents: AgentCollaborationMetrics[] = mockAgents.map((a, i) => {
    const totalHandoffs = a.handoffsSent + a.handoffsReceived;
    const collaborationScore = computeCollaborationScore(
      a.handoffsSent,
      a.handoffsReceived,
      a.uniqueCollaborators,
      totalAgents,
    );
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.agentName,
      agentRole: a.agentRole,
      handoffsSent: a.handoffsSent,
      handoffsReceived: a.handoffsReceived,
      totalHandoffs,
      uniqueCollaborators: a.uniqueCollaborators,
      collaborationScore,
      collaborationTier: getCollaborationTier(collaborationScore),
      isHub: a.handoffsReceived >= 5,
      isIsolated: totalHandoffs === 0,
    };
  });

  agents.sort((a, b) => b.collaborationScore - a.collaborationScore);

  const totalHandoffs = agents.reduce((s, a) => s + a.handoffsSent, 0);
  const avgCollaborationScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.collaborationScore, 0) / agents.length)
      : 0;
  const hubCount = agents.filter((a) => a.isHub).length;
  const isolatedCount = agents.filter((a) => a.isIsolated).length;

  const topHandoffPair = agents.length >= 2
    ? { fromAgent: agents[0].agentName, toAgent: agents[1].agentName, count: agents[0].handoffsSent }
    : null;

  let aiSummary = 'Collaboration network analysis complete.';
  let aiRecommendations: string[] = [
    'Integrate isolated agents into team workflows through structured pairing.',
    'Distribute inbound handoffs more evenly to reduce hub overload.',
    'Build cross-functional channels between agents with no direct collaboration.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent collaboration network: ${totalAgents} agents, ${totalHandoffs} total handoffs, avg score ${avgCollaborationScore}, ${hubCount} hubs, ${isolatedCount} isolated. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI collaboration network analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents,
      totalHandoffs,
      avgCollaborationScore,
      hubCount,
      isolatedCount,
      topHandoffPair,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
