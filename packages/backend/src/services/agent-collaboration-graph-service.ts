import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface CollaborationEdge {
  sourcePersonaId: string;
  targetPersonaId: string;
  handoffCount: number;
  successfulHandoffs: number;
  successRate: number;
  avgContextLength: number;
  collaborationStrength: number;
}

export interface AgentNetworkProfile {
  personaId: string;
  totalHandoffs: number;
  outgoingHandoffs: number;
  incomingHandoffs: number;
  uniqueCollaborators: number;
  avgCollaborationStrength: number;
  centralityScore: number;
  role: 'hub' | 'bridge' | 'contributor' | 'isolated';
}

export interface AgentCollaborationGraphReport {
  edges: CollaborationEdge[];
  agents: AgentNetworkProfile[];
  mostActiveCollaborators: string[];
  strongestPair: { source: string; target: string; strength: number };
  mostIsolatedAgent: string;
  networkDensity: number;
  aiSummary?: string;
  recommendations?: string[];
}

export interface RawHandoffRecord {
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  content: string;
  status: string | null;
}

export interface RawTicketRecord {
  id: string;
  assignedPersona: string | null;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

export function computeCollaborationStrength(successRate: number, handoffCount: number): number {
  return (successRate * 0.6) + (Math.min(handoffCount, 10) / 10 * 40);
}

function isSuccessfulHandoff(toStatus: string | null): boolean {
  const successStatuses = ['in_progress', 'review', 'qa', 'acceptance', 'done'];
  return toStatus != null && successStatuses.includes(toStatus);
}

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

export function computeCollaborationGraph(
  projectTickets: RawTicketRecord[],
  handoffRecords: RawHandoffRecord[],
): Omit<AgentCollaborationGraphReport, 'aiSummary' | 'recommendations'> {
  // Build ticketId -> status map
  const ticketStatusMap = new Map<string, string>();
  for (const t of projectTickets) {
    ticketStatusMap.set(t.id, (t as unknown as { status?: string }).status ?? 'backlog');
  }

  // Collect all personas
  const allPersonas = new Set<string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) allPersonas.add(t.assignedPersona);
  }

  // Filter valid handoffs: need handoffFrom and handoffTo
  const validHandoffs = handoffRecords.filter((n) => n.handoffFrom != null && n.handoffTo != null);

  // Add personas from handoffs
  for (const h of validHandoffs) {
    if (h.handoffFrom) allPersonas.add(h.handoffFrom);
    if (h.handoffTo) allPersonas.add(h.handoffTo);
  }

  if (allPersonas.size === 0 || validHandoffs.length === 0) {
    const personaList = [...allPersonas];
    const agents: AgentNetworkProfile[] = personaList.map((p) => ({
      personaId: p,
      totalHandoffs: 0,
      outgoingHandoffs: 0,
      incomingHandoffs: 0,
      uniqueCollaborators: 0,
      avgCollaborationStrength: 0,
      centralityScore: 0,
      role: 'isolated' as const,
    }));

    return {
      edges: [],
      agents,
      mostActiveCollaborators: [],
      strongestPair: { source: '', target: '', strength: 0 },
      mostIsolatedAgent: personaList[0] ?? '',
      networkDensity: 0,
    };
  }

  // Merge bidirectional handoffs into undirected edges
  interface EdgeAccumulator {
    personaA: string;
    personaB: string;
    handoffCount: number;
    successfulHandoffs: number;
    totalContentLength: number;
  }

  const edgeMap = new Map<string, EdgeAccumulator>();

  for (const h of validHandoffs) {
    const from = h.handoffFrom as string;
    const to = h.handoffTo as string;
    const key = edgeKey(from, to);
    const [personaA, personaB] = from < to ? [from, to] : [to, from];

    const ticketStatus = h.status ?? ticketStatusMap.get(h.ticketId) ?? null;
    const successful = isSuccessfulHandoff(ticketStatus);

    const existing = edgeMap.get(key);
    if (existing) {
      existing.handoffCount += 1;
      if (successful) existing.successfulHandoffs += 1;
      existing.totalContentLength += h.content.length;
    } else {
      edgeMap.set(key, {
        personaA,
        personaB,
        handoffCount: 1,
        successfulHandoffs: successful ? 1 : 0,
        totalContentLength: h.content.length,
      });
    }
  }

  // Build edges
  const edges: CollaborationEdge[] = [];
  for (const acc of edgeMap.values()) {
    const successRate = acc.handoffCount > 0 ? acc.successfulHandoffs / acc.handoffCount : 0;
    const avgContextLength = acc.handoffCount > 0 ? acc.totalContentLength / acc.handoffCount : 0;
    const collaborationStrength = computeCollaborationStrength(successRate, acc.handoffCount);
    edges.push({
      sourcePersonaId: acc.personaA,
      targetPersonaId: acc.personaB,
      handoffCount: acc.handoffCount,
      successfulHandoffs: acc.successfulHandoffs,
      successRate,
      avgContextLength,
      collaborationStrength,
    });
  }

  // Build agent profiles
  // Track outgoing and incoming per persona
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const collaborators = new Map<string, Set<string>>();

  for (const h of validHandoffs) {
    const from = h.handoffFrom as string;
    const to = h.handoffTo as string;
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);

    if (!collaborators.has(from)) collaborators.set(from, new Set());
    if (!collaborators.has(to)) collaborators.set(to, new Set());
    collaborators.get(from)!.add(to);
    collaborators.get(to)!.add(from);
  }

  // Ensure all personas are represented
  for (const p of allPersonas) {
    if (!collaborators.has(p)) collaborators.set(p, new Set());
  }

  const maxUniqueCollaborators = Math.max(...[...collaborators.values()].map((s) => s.size), 1);

  const agents: AgentNetworkProfile[] = [];
  for (const p of allPersonas) {
    const uniqueCollabs = collaborators.get(p)?.size ?? 0;
    const out = outgoing.get(p) ?? 0;
    const inc = incoming.get(p) ?? 0;
    const total = out + inc;
    const centralityScore = (uniqueCollabs / maxUniqueCollaborators) * 100;

    // Compute avg collaboration strength for this agent
    const agentEdges = edges.filter(
      (e) => e.sourcePersonaId === p || e.targetPersonaId === p,
    );
    const avgCollabStrength =
      agentEdges.length > 0
        ? agentEdges.reduce((sum, e) => sum + e.collaborationStrength, 0) / agentEdges.length
        : 0;

    let role: AgentNetworkProfile['role'];
    if (centralityScore >= 70) role = 'hub';
    else if (centralityScore >= 40) role = 'bridge';
    else if (centralityScore >= 15) role = 'contributor';
    else role = 'isolated';

    agents.push({
      personaId: p,
      totalHandoffs: total,
      outgoingHandoffs: out,
      incomingHandoffs: inc,
      uniqueCollaborators: uniqueCollabs,
      avgCollaborationStrength: avgCollabStrength,
      centralityScore,
      role,
    });
  }

  // mostActiveCollaborators: top 3 by totalHandoffs
  const sortedByHandoffs = [...agents].sort((a, b) => b.totalHandoffs - a.totalHandoffs);
  const mostActiveCollaborators = sortedByHandoffs.slice(0, 3).map((a) => a.personaId);

  // strongestPair: edge with highest collaborationStrength
  let strongestPair = { source: '', target: '', strength: 0 };
  for (const edge of edges) {
    if (edge.collaborationStrength > strongestPair.strength) {
      strongestPair = {
        source: edge.sourcePersonaId,
        target: edge.targetPersonaId,
        strength: edge.collaborationStrength,
      };
    }
  }

  // mostIsolatedAgent: agent with lowest centralityScore
  let mostIsolatedAgent = agents[0]?.personaId ?? '';
  let lowestCentrality = Infinity;
  for (const agent of agents) {
    if (agent.centralityScore < lowestCentrality) {
      lowestCentrality = agent.centralityScore;
      mostIsolatedAgent = agent.personaId;
    }
  }

  // networkDensity: actual edges / possible edges * 100
  const n = allPersonas.size;
  const possibleEdges = n > 1 ? (n * (n - 1)) / 2 : 0;
  const networkDensity = possibleEdges > 0 ? (edges.length / possibleEdges) * 100 : 0;

  return {
    edges,
    agents,
    mostActiveCollaborators,
    strongestPair,
    mostIsolatedAgent,
    networkDensity,
  };
}

export async function analyzeCollaborationGraph(projectId: string): Promise<AgentCollaborationGraphReport> {
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  let handoffRecords: RawHandoffRecord[] = [];

  if (ticketIds.length > 0) {
    const allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        content: ticketNotes.content,
      })
      .from(ticketNotes)
      .where(isNotNull(ticketNotes.handoffFrom));

    const ticketStatusMap = new Map(projectTickets.map((t) => [t.id, t.status]));
    const ticketIdSet = new Set(ticketIds);

    handoffRecords = allNotes
      .filter((n) => ticketIdSet.has(n.ticketId))
      .map((n) => ({
        ticketId: n.ticketId,
        handoffFrom: n.handoffFrom,
        handoffTo: n.handoffTo,
        content: n.content,
        status: ticketStatusMap.get(n.ticketId) ?? null,
      }));
  }

  const baseReport = computeCollaborationGraph(
    projectTickets.map((t) => ({ id: t.id, assignedPersona: t.assignedPersona })),
    handoffRecords,
  );

  let aiSummary: string | undefined;
  let recommendations: string[] | undefined;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const edgeSummary = baseReport.edges
      .slice(0, 10)
      .map(
        (e) =>
          `${e.sourcePersonaId} <-> ${e.targetPersonaId}: ${e.handoffCount} handoffs, strength=${e.collaborationStrength.toFixed(1)}, successRate=${(e.successRate * 100).toFixed(0)}%`,
      )
      .join('\n');

    const agentSummary = baseReport.agents
      .slice(0, 10)
      .map((a) => `${a.personaId}: role=${a.role}, centrality=${a.centralityScore.toFixed(1)}`)
      .join('\n');

    const prompt = `Analyze this agent collaboration graph and provide a JSON object with "aiSummary" (a short paragraph about collaboration patterns) and "recommendations" (array of 2-3 actionable strings).

Network density: ${baseReport.networkDensity.toFixed(1)}%
Most active: ${baseReport.mostActiveCollaborators.join(', ')}
Strongest pair: ${baseReport.strongestPair.source} <-> ${baseReport.strongestPair.target} (strength=${baseReport.strongestPair.strength.toFixed(1)})
Most isolated: ${baseReport.mostIsolatedAgent}

Top edges:
${edgeSummary}

Agent roles:
${agentSummary}

Return only valid JSON, no markdown.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      const parsed = JSON.parse(extractJSONFromText(text));
      aiSummary = parsed.aiSummary;
      recommendations = parsed.recommendations;
    }
  } catch (e) {
    console.warn('Agent collaboration graph AI analysis failed, skipping:', e);
  }

  return {
    ...baseReport,
    aiSummary,
    recommendations,
  };
}
