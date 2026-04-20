export interface AgentCommunicationMetrics {
  agentId: string;
  agentName: string;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  uniquePartners: number;
  avgChainDepth: number;
  maxChainDepth: number;
  avgResponseLatencyMs: number;
  bottleneckScore: number;
  communicationRole: 'hub' | 'relay' | 'leaf' | 'isolated';
}

export interface AgentCommunicationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalMessages: number;
    avgChainDepth: number;
    maxChainDepth: number;
    topBottleneck: string | null;
    hubAgents: number;
  };
  agents: AgentCommunicationMetrics[];
  insights: string[];
  recommendations: string[];
}

function assignCommunicationRole(
  uniquePartners: number,
  totalMessages: number,
): AgentCommunicationMetrics['communicationRole'] {
  if (uniquePartners >= 4 && totalMessages >= 10) return 'hub';
  if (uniquePartners >= 2 && totalMessages >= 5) return 'relay';
  if (uniquePartners >= 1 && totalMessages > 0) return 'leaf';
  return 'isolated';
}

function computeBottleneckScore(
  messagesReceived: number,
  totalMessages: number,
  uniquePartners: number,
  avgResponseLatencyMs: number,
): number {
  const base = (messagesReceived / Math.max(totalMessages, 1)) * 100;
  let score = base;
  if (uniquePartners >= 4) score += 15;
  if (avgResponseLatencyMs < 500) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function analyzeAgentCommunicationPatterns(
  projectId: string,
  sessions: any[],
): AgentCommunicationReport {
  if (sessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        totalMessages: 0,
        avgChainDepth: 0,
        maxChainDepth: 0,
        topBottleneck: null,
        hubAgents: 0,
      },
      agents: [],
      insights: ['No sessions found for this project.'],
      recommendations: ['Create agent sessions to begin communication analysis.'],
    };
  }

  // Collect all agents from sessions
  const agentSet = new Set<string>();
  for (const s of sessions) {
    if (s.personaId) agentSet.add(s.personaId);
    if (s.assignedTo) agentSet.add(s.assignedTo);
  }

  type AgentStats = {
    sent: number;
    received: number;
    partners: Set<string>;
    latencies: number[];
  };

  const agentMap = new Map<string, AgentStats>();
  for (const agent of agentSet) {
    agentMap.set(agent, { sent: 0, received: 0, partners: new Set(), latencies: [] });
  }

  // Derive messages from handoff chains
  const handoffs: Array<{ from: string; to: string; createdAt?: string }> = [];

  for (const s of sessions) {
    const from = s.personaId || s.assignedTo;
    const to = s.handoffTo;
    if (from && to && from !== to) {
      handoffs.push({ from, to, createdAt: s.createdAt });
      if (!agentMap.has(to)) {
        agentSet.add(to);
        agentMap.set(to, { sent: 0, received: 0, partners: new Set(), latencies: [] });
      }
    }
  }

  // Process handoffs
  for (let i = 0; i < handoffs.length; i++) {
    const h = handoffs[i];
    const fromStats = agentMap.get(h.from);
    const toStats = agentMap.get(h.to);

    if (fromStats) {
      fromStats.sent++;
      fromStats.partners.add(h.to);
    }
    if (toStats) {
      toStats.received++;
      toStats.partners.add(h.from);
    }

    // Latency: time to next handoff
    if (i + 1 < handoffs.length && h.createdAt && handoffs[i + 1].createdAt) {
      const latencyMs =
        new Date(handoffs[i + 1].createdAt!).getTime() - new Date(h.createdAt).getTime();
      if (latencyMs > 0 && toStats) {
        toStats.latencies.push(latencyMs);
      }
    }
  }

  // Chain depths
  const chainDepths: number[] = [];
  if (handoffs.length > 0) {
    let depth = 1;
    for (let i = 1; i < handoffs.length; i++) {
      if (handoffs[i].from === handoffs[i - 1].to) {
        depth++;
      } else {
        chainDepths.push(depth);
        depth = 1;
      }
    }
    chainDepths.push(depth);
  }

  const avgChainDepth =
    chainDepths.length > 0 ? chainDepths.reduce((a, b) => a + b, 0) / chainDepths.length : 0;
  const maxChainDepth = chainDepths.length > 0 ? Math.max(...chainDepths) : 0;

  const agents: AgentCommunicationMetrics[] = [];

  for (const [agentId, stats] of agentMap.entries()) {
    const totalMessages = stats.sent + stats.received;
    const uniquePartners = stats.partners.size;
    const avgResponseLatencyMs =
      stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 1000;

    const communicationRole = assignCommunicationRole(uniquePartners, totalMessages);
    const bottleneckScore = computeBottleneckScore(
      stats.received,
      totalMessages,
      uniquePartners,
      avgResponseLatencyMs,
    );

    const agentName =
      agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/_/g, ' ');

    agents.push({
      agentId,
      agentName,
      totalMessages,
      messagesSent: stats.sent,
      messagesReceived: stats.received,
      uniquePartners,
      avgChainDepth: Math.round(avgChainDepth * 10) / 10,
      maxChainDepth,
      avgResponseLatencyMs: Math.round(avgResponseLatencyMs),
      bottleneckScore: Math.round(bottleneckScore * 10) / 10,
      communicationRole,
    });
  }

  agents.sort((a, b) => b.bottleneckScore - a.bottleneckScore);

  const totalMessages = handoffs.length;
  const hubAgents = agents.filter((a) => a.communicationRole === 'hub').length;
  const topBottleneck = agents.length > 0 ? agents[0].agentName : null;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      totalMessages,
      avgChainDepth: Math.round(avgChainDepth * 10) / 10,
      maxChainDepth,
      topBottleneck,
      hubAgents,
    },
    agents,
    insights: [
      `Analyzed ${agents.length} agents across ${totalMessages} handoff messages.`,
      `Average communication chain depth: ${avgChainDepth.toFixed(1)}.`,
    ],
    recommendations: [
      'Review hub agents for potential bottlenecks.',
      'Consider load balancing for isolated agents.',
    ],
  };
}
