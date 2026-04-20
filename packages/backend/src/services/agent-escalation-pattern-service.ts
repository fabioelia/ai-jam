import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface EscalationChain {
  fromAgent: string;
  toAgent: string;
  count: number;
}

export interface EscalationHotspot {
  agentPersona: string;
  escalationCount: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface EscalationPatternReport {
  projectId: string;
  analyzedAt: string;
  chains: EscalationChain[];
  hotspots: EscalationHotspot[];
  circularPatterns: string[][];
  totalEscalations: number;
  avgChainLength: number;
  aiSummary: string;
  aiRecommendations: string[];
}

const FALLBACK_SUMMARY = 'Review escalation patterns to identify bottlenecks and improve agent handoff processes.';
const FALLBACK_RECOMMENDATIONS = ['Investigate agents with high escalation rates and consider redistributing workload.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function detectCycles(chains: EscalationChain[]): string[][] {
  // Build adjacency list
  const graph = new Map<string, Set<string>>();
  for (const chain of chains) {
    if (!graph.has(chain.fromAgent)) graph.set(chain.fromAgent, new Set());
    graph.get(chain.fromAgent)!.add(chain.toAgent);
  }

  const cycles: string[][] = [];
  const seen = new Set<string>();

  function dfs(path: string[], visited: Set<string>): void {
    if (cycles.length >= 10) return;
    const current = path[path.length - 1];
    const neighbors = graph.get(current) || new Set();
    for (const neighbor of neighbors) {
      const cycleStart = path.indexOf(neighbor);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        if (cycle.length >= 2 && cycle.length <= 5) {
          // Normalize: start with lex-smallest
          const minIdx = cycle.indexOf([...cycle].sort()[0]);
          const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          const key = normalized.join('->');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(normalized);
          }
        }
      } else if (!visited.has(neighbor) && path.length < 5) {
        visited.add(neighbor);
        dfs([...path, neighbor], visited);
        visited.delete(neighbor);
      }
    }
  }

  const allAgents = new Set([...graph.keys()]);
  for (const agent of allAgents) {
    dfs([agent], new Set([agent]));
  }

  return cycles.slice(0, 10);
}

export async function analyzeEscalationPatterns(projectId: string): Promise<EscalationPatternReport> {
  const now = new Date();

  // Get handoff notes for tickets in this project
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);

  let handoffs: { handoffFrom: string | null; handoffTo: string | null }[] = [];

  if (ticketIds.length > 0) {
    // Get all notes with handoff data for project tickets
    const allNotes = await db
      .select({ handoffFrom: ticketNotes.handoffFrom, handoffTo: ticketNotes.handoffTo })
      .from(ticketNotes)
      .where(and(isNotNull(ticketNotes.handoffFrom), isNotNull(ticketNotes.handoffTo)));

    handoffs = allNotes.filter(n => n.handoffFrom && n.handoffTo);
  }

  if (handoffs.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      chains: [],
      hotspots: [],
      circularPatterns: [],
      totalEscalations: 0,
      avgChainLength: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Count chains
  const chainMap = new Map<string, number>();
  const agentEscalationCount = new Map<string, number>();

  for (const h of handoffs) {
    const key = `${h.handoffFrom}→${h.handoffTo}`;
    chainMap.set(key, (chainMap.get(key) || 0) + 1);
    agentEscalationCount.set(h.handoffFrom!, (agentEscalationCount.get(h.handoffFrom!) || 0) + 1);
    agentEscalationCount.set(h.handoffTo!, (agentEscalationCount.get(h.handoffTo!) || 0) + 1);
  }

  const totalEscalations = handoffs.length;

  const chains: EscalationChain[] = [...chainMap.entries()]
    .map(([key, count]) => {
      const [fromAgent, toAgent] = key.split('→');
      return { fromAgent, toAgent, count };
    })
    .sort((a, b) => b.count - a.count);

  const hotspots: EscalationHotspot[] = [...agentEscalationCount.entries()]
    .map(([agentPersona, escalationCount]) => {
      const pct = escalationCount / totalEscalations;
      let severity: 'critical' | 'high' | 'moderate' | 'low';
      if (pct >= 0.6) severity = 'critical';
      else if (pct >= 0.4) severity = 'high';
      else if (pct >= 0.2) severity = 'moderate';
      else severity = 'low';
      return { agentPersona, escalationCount, severity };
    })
    .sort((a, b) => b.escalationCount - a.escalationCount);

  const circularPatterns = detectCycles(chains);
  const avgChainLength = chains.length > 0
    ? Math.round((chains.reduce((s, c) => s + c.count, 0) / chains.length) * 10) / 10
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify({ totalEscalations, topChains: chains.slice(0, 3), hotspots: hotspots.slice(0, 3) });
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent escalation patterns. Give 2-sentence summary and 2-3 recommendations. Output JSON: {aiSummary: string, aiRecommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string; aiRecommendations: string[] };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
    if (Array.isArray(parsed.aiRecommendations) && parsed.aiRecommendations.length > 0) aiRecommendations = parsed.aiRecommendations;
  } catch (e) {
    console.warn('Agent escalation pattern AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    chains,
    hotspots,
    circularPatterns,
    totalEscalations,
    avgChainLength,
    aiSummary,
    aiRecommendations,
  };
}
