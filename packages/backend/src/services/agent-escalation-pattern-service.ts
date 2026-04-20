import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface EscalationChain {
  fromAgent: string;
  toAgent: string;
  count: number;
  avgResolutionTime: number | null;
  topTriggers: string[];
}

export interface EscalationHotspot {
  agentId: string;
  escalationsReceived: number;
  escalationsSent: number;
  escalationRate: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface EscalationAnalysis {
  chains: EscalationChain[];
  hotspots: EscalationHotspot[];
  circularPatterns: string[][];
  totalEscalations: number;
  avgChainLength: number;
  aiSummary: string;
  aiRecommendations: string[];
}

const FALLBACK_SUMMARY = 'Analysis unavailable';
const FALLBACK_RECOMMENDATIONS: string[] = [];
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function computeSeverity(rate: number): EscalationHotspot['severity'] {
  if (rate >= 60) return 'critical';
  if (rate >= 40) return 'high';
  if (rate >= 20) return 'moderate';
  return 'low';
}

function detectCycles(edges: { from: string; to: string }[]): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!graph.has(e.from)) graph.set(e.from, new Set());
    graph.get(e.from)!.add(e.to);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (cycles.length >= 10) return;
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (inStack.has(neighbor)) {
        // Found a cycle — extract it
        const cycleStart = path.indexOf(neighbor);
        const rawCycle = path.slice(cycleStart);
        const len = rawCycle.length;
        if (len >= 2 && len <= 5) {
          // Normalize: start with lex-smallest agent
          const minIdx = rawCycle.indexOf([...rawCycle].sort()[0]);
          const normalized = [...rawCycle.slice(minIdx), ...rawCycle.slice(0, minIdx)];
          normalized.push(normalized[0]);
          // Deduplicate cycles
          const key = normalized.join('→');
          if (!cycles.some((c) => c.join('→') === key)) {
            cycles.push(normalized);
          }
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor);
        if (cycles.length >= 10) break;
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node);
    if (cycles.length >= 10) break;
  }

  return cycles;
}

export async function analyzeEscalationPatterns(projectId: string): Promise<EscalationAnalysis> {
  const empty: EscalationAnalysis = {
    chains: [],
    hotspots: [],
    circularPatterns: [],
    totalEscalations: 0,
    avgChainLength: 0,
    aiSummary: FALLBACK_SUMMARY,
    aiRecommendations: FALLBACK_RECOMMENDATIONS,
  };

  const [allTickets, allNotes] = await Promise.all([
    db.select({ id: tickets.id, title: tickets.title, status: tickets.status, updatedAt: tickets.updatedAt })
      .from(tickets)
      .where(eq(tickets.projectId, projectId)),
    db.select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
    })
      .from(ticketNotes)
      .where(isNotNull(ticketNotes.handoffFrom)),
  ]);

  const ticketMap = new Map(allTickets.map((t) => [t.id, t]));

  // Filter notes to project tickets only, sort by createdAt
  const projectNotes = allNotes
    .filter((n) => ticketMap.has(n.ticketId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (projectNotes.length === 0) return empty;

  // Group notes by ticketId
  const notesByTicket = new Map<string, typeof projectNotes>();
  for (const n of projectNotes) {
    if (!notesByTicket.has(n.ticketId)) notesByTicket.set(n.ticketId, []);
    notesByTicket.get(n.ticketId)!.push(n);
  }

  // Detect escalations: consecutive handoffs on same ticket where gap <= 2h
  // and prev.handoffTo === curr.handoffFrom (re-escalation proxy)
  type EscalationEvent = {
    fromAgent: string;
    toAgent: string;
    ticketId: string;
    escalatedAt: Date;
  };
  const escalationEvents: EscalationEvent[] = [];

  for (const [ticketId, notes] of notesByTicket) {
    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1];
      const curr = notes[i];
      if (
        prev.handoffTo != null &&
        curr.handoffFrom != null &&
        prev.handoffTo === curr.handoffFrom &&
        curr.handoffFrom != null &&
        curr.handoffTo != null &&
        curr.createdAt.getTime() - prev.createdAt.getTime() <= TWO_HOURS_MS
      ) {
        escalationEvents.push({
          fromAgent: curr.handoffFrom,
          toAgent: curr.handoffTo,
          ticketId,
          escalatedAt: curr.createdAt,
        });
      }
    }
  }

  if (escalationEvents.length === 0) return empty;

  const totalEscalations = escalationEvents.length;

  // Build chains: edge (fromAgent, toAgent) → { count, ticketIds, resolutionTimes }
  type EdgeAcc = {
    count: number;
    ticketIds: Set<string>;
    resolutionTimes: (number | null)[];
  };
  const edgeMap = new Map<string, EdgeAcc>();

  for (const ev of escalationEvents) {
    const key = `${ev.fromAgent}|||${ev.toAgent}`;
    if (!edgeMap.has(key)) edgeMap.set(key, { count: 0, ticketIds: new Set(), resolutionTimes: [] });
    const acc = edgeMap.get(key)!;
    if (!acc.ticketIds.has(ev.ticketId)) {
      acc.ticketIds.add(ev.ticketId);
      acc.count++;
      const ticket = ticketMap.get(ev.ticketId);
      if (ticket?.status === 'done') {
        const resolutionMs = ticket.updatedAt.getTime() - ev.escalatedAt.getTime();
        acc.resolutionTimes.push(Math.max(0, resolutionMs) / (60 * 60 * 1000));
      } else {
        acc.resolutionTimes.push(null);
      }
    }
  }

  const chains: EscalationChain[] = [];
  for (const [key, acc] of edgeMap) {
    const [fromAgent, toAgent] = key.split('|||');
    const resolvedTimes = acc.resolutionTimes.filter((t): t is number => t !== null);
    const avgResolutionTime =
      resolvedTimes.length > 0
        ? Math.round((resolvedTimes.reduce((s, t) => s + t, 0) / resolvedTimes.length) * 10) / 10
        : null;
    const topTriggers = [...acc.ticketIds]
      .slice(0, 3)
      .map((tid) => ticketMap.get(tid)?.title ?? tid);
    chains.push({ fromAgent, toAgent, count: acc.count, avgResolutionTime, topTriggers });
  }
  chains.sort((a, b) => b.count - a.count);

  // Build hotspots
  // Per agent: total handoffs (all notes where handoffFrom = agent or handoffTo = agent per ticket)
  const agentHandoffCounts = new Map<string, number>();
  for (const n of projectNotes) {
    if (n.handoffFrom) {
      agentHandoffCounts.set(n.handoffFrom, (agentHandoffCounts.get(n.handoffFrom) ?? 0) + 1);
    }
  }

  const agentEscalSent = new Map<string, number>();
  const agentEscalReceived = new Map<string, number>();
  for (const ev of escalationEvents) {
    agentEscalSent.set(ev.fromAgent, (agentEscalSent.get(ev.fromAgent) ?? 0) + 1);
    agentEscalReceived.set(ev.toAgent, (agentEscalReceived.get(ev.toAgent) ?? 0) + 1);
  }

  const allHotspotAgents = new Set([...agentEscalSent.keys(), ...agentEscalReceived.keys()]);
  const hotspots: EscalationHotspot[] = [];

  for (const agentId of allHotspotAgents) {
    const escalationsSent = agentEscalSent.get(agentId) ?? 0;
    const escalationsReceived = agentEscalReceived.get(agentId) ?? 0;
    if (escalationsSent === 0) continue; // only agents that sent escalations
    const totalHandoffs = agentHandoffCounts.get(agentId) ?? 1;
    const escalationRate =
      Math.round((escalationsSent / Math.max(1, totalHandoffs)) * 100 * 10) / 10;
    const severity = computeSeverity(escalationRate);
    hotspots.push({ agentId, escalationsReceived, escalationsSent, escalationRate, severity });
  }
  hotspots.sort((a, b) => b.escalationRate - a.escalationRate);

  // Circular pattern detection
  const edges = chains.map((c) => ({ from: c.fromAgent, to: c.toAgent }));
  const circularPatterns = detectCycles(edges);

  // avgChainLength: per ticket, count escalation hops; average across tickets with >= 1 escalation
  const ticketHops = new Map<string, number>();
  for (const ev of escalationEvents) {
    ticketHops.set(ev.ticketId, (ticketHops.get(ev.ticketId) ?? 0) + 1);
  }
  const hopValues = [...ticketHops.values()];
  const avgChainLength =
    hopValues.length > 0
      ? Math.round((hopValues.reduce((s, h) => s + h, 0) / hopValues.length) * 10) / 10
      : 0;

  // AI summary + recommendations
  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });
    const topChains = chains
      .slice(0, 3)
      .map((c) => `${c.fromAgent}→${c.toAgent}(${c.count}x)`)
      .join(', ');
    const prompt = `Analyze escalation patterns for AI agents. Data: ${totalEscalations} total escalations, ${hotspots.length} hotspot agents, ${circularPatterns.length} circular loops.\nTop chains: ${topChains}.\nProvide: 1) 2-sentence summary of systemic issues, 2) up to 5 concrete recommendations.\nReturn JSON: {"summary": "...", "recommendations": ["...", ...]}.`;
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { summary?: string; recommendations?: string[] };
    if (parsed.summary) aiSummary = parsed.summary;
    if (Array.isArray(parsed.recommendations)) {
      aiRecommendations = parsed.recommendations.slice(0, 5);
    }
  } catch {
    // fallback values already set
  }

  return {
    chains,
    hotspots,
    circularPatterns,
    totalEscalations,
    avgChainLength,
    aiSummary,
    aiRecommendations,
  };
}
