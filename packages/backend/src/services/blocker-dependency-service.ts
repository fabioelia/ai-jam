import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface DependencyEdge {
  fromTicketId: string;
  toTicketId: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  source: 'heuristic' | 'ai';
}

export interface TicketBlockerInfo {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  blockerScore: number;
  blocksCount: number;
  dependsOnCount: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface DependencyAnalysisResult {
  projectId: string;
  totalTickets: number;
  dependencyCount: number;
  criticalBlockers: TicketBlockerInfo[];
  allBlockers: TicketBlockerInfo[];
  edges: DependencyEdge[];
  riskSummary: string;
  analyzedAt: string;
}

const DEPENDENCY_PATTERNS = [
  /(?:requires)\s+(?:that\s+)?(?:"([^"]+)"|the\s+(?:.+?)(?:\s+(?:ticket|task|feature)?)[\s,.])/i,
  /(?:depends\s+on)\s+(?:"([^"]+)"|(.+?)(?:[\s,.]|$))/i,
  /(?:needs)\s+(?:x\s+)?(?:to\s+)?(?:be\s+)?(?:done|completed|built|implemented)(?:\s+before|\s+first)?/i,
  /(?:after)\s+(?:"([^"]+)"|(.+?))\s+(?:is\s+)?(?:done|completed|finished|built)/i,
  /(?:blocked\s+by)\s+(?:"([^"]+)"|(.+?)(?:[\s,.]|$))/i,
  /(?:prerequisite)\s*[:\-]?\s*(?:"([^"]+)"|(.+?)(?:[\s,.]|$))/i,
  /(?:once)\s+(?:"([^"]+)"|(.+?))\s+(?:is\s+)?(?:done|completed)/i,
];

const STATUS_PENALTY: Record<string, number> = {
  backlog: 30,
  idea: 30,
  in_progress: 0,
  review: 0,
  qa: 0,
  acceptance: 0,
  done: 0,
};

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['this', 'that', 'with', 'from', 'have', 'will', 'them', 'these', 'those', 'where', 'about'].includes(w));
}

function buildHeuristicEdges(workingTickets: { id: string; title: string; description?: string | null; status: string; projectId: string }[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  for (let i = 0; i < workingTickets.length; i++) {
    for (let j = 0; j < workingTickets.length; j++) {
      if (i === j) continue;
      const ticketA = workingTickets[i]; // potential dependency (must complete first)
      const ticketB = workingTickets[j]; // ticket that may depend on A

      if (!ticketB.description) continue;

      const descLower = ticketB.description.toLowerCase();
      const titleLower = ticketA.title.toLowerCase();
      const keywords = extractKeywords(ticketA.title);

      let foundReason = '';
      let confidence: DependencyEdge['confidence'] = 'low';

      // Check explicit patterns
      for (const pattern of DEPENDENCY_PATTERNS) {
        const match = pattern.exec(ticketB.description);
        if (match) {
          const matchedText = (match[1] || match[2] || '').toLowerCase().trim();
          if (matchedText && (titleLower.includes(matchedText) || matchedText.includes(titleLower.substring(0, 30)) || titleLower.substring(0, 30).includes(matchedText.substring(0, 20)))) {
            foundReason = `Ticket "${ticketB.title}" mentions "${titleLower}" with dependency phrase`;
            confidence = 'high';
            break;
          }
        }
      }

      // If no pattern match, check for simple keyword overlap in description
      if (!foundReason) {
        const keywordMatches = keywords.filter(kw => descLower.includes(kw));
        if (keywordMatches.length >= 2) {
          foundReason = `Ticket "${ticketB.title}" description references keywords from "${ticketA.title}"`;
          confidence = keywordMatches.length >= 3 ? 'high' : 'medium';
        }
      }

      // Direct title mention
      if (!foundReason && descLower.includes(titleLower)) {
        foundReason = `Ticket "${ticketB.title}" explicitly mentions "${ticketA.title}" in description`;
        confidence = 'high';
      }

      if (foundReason) {
        edges.push({
          fromTicketId: ticketB.id,
          toTicketId: ticketA.id,
          reason: foundReason,
          confidence,
          source: 'heuristic',
        });
      }
    }
  }

  return edges;
}

function computeBlockerInfo(
  workingTickets: { id: string; title: string; description?: string | null; status: string; projectId: string }[],
  edges: DependencyEdge[],
): { blockers: Map<string, TicketBlockerInfo>; criticalBlockers: TicketBlockerInfo[] } {
  const ticketMap = new Map(workingTickets.map(t => [t.id, t]));

  // Count dependencies
  const blocksCount = new Map<string, number>();
  const dependsOnCount = new Map<string, number>();

  for (const edge of edges) {
    blocksCount.set(edge.toTicketId, (blocksCount.get(edge.toTicketId) || 0) + 1);
    dependsOnCount.set(edge.fromTicketId, (dependsOnCount.get(edge.fromTicketId) || 0) + 1);
  }

  const blockers = new Map<string, TicketBlockerInfo>();

  for (const ticket of workingTickets) {
    const bCount = blocksCount.get(ticket.id) || 0;
    const dCount = dependsOnCount.get(ticket.id) || 0;

    if (bCount === 0 && dCount === 0) continue;

    const blockerScore = Math.min(100, bCount * 20 + (STATUS_PENALTY[ticket.status] ?? 0));

    let riskLevel: TicketBlockerInfo['riskLevel'] = 'low';
    if (blockerScore >= 75) riskLevel = 'critical';
    else if (blockerScore >= 50) riskLevel = 'high';
    else if (blockerScore >= 25) riskLevel = 'medium';

    blockers.set(ticket.id, {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketStatus: ticket.status,
      blockerScore,
      blocksCount: bCount,
      dependsOnCount: dCount,
      riskLevel,
    });
  }

  const criticalBlockers = [...blockers.values()].filter(b => b.riskLevel === 'critical');

  return { blockers, criticalBlockers };
}

async function callAIForDependencies(
  projectId: string,
  workingTickets: { id: string; title: string; description?: string | null; status: string; projectId: string }[],
): Promise<{ edges: DependencyEdge[]; riskSummary: string }> {
  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const ticketSummaries = workingTickets.map(t =>
    `- [${t.id.substring(0, 8)}] "${t.title}" | status: ${t.status}`
  ).join('\n');

  const prompt = `Analyze these project tickets for non-obvious dependencies and blocker risks.

Tickets (${workingTickets.length}):
${ticketSummaries}

Return ONLY a JSON object with:
{
  "edges": [
    {"fromTicketId": "<id>", "toTicketId": "<id>", "reason": "<why>", "confidence": "low|medium|high"}
  ],
  "riskSummary": "<1-2 sentence summary of overall dependency risk>"
}

Rules:
- Only include non-obvious dependencies not easily seen from keyword matching
- fromTicketId depends on toTicketId
- confidence should be 'low' for speculative, 'medium' for reasonable, 'high' for clear
- max 5 edges
- riskSummary: 1-2 sentences covering the biggest risk`;

  const response = await client.messages.create({
    model: process.env.AI_MODEL || 'qwen/qwen3-6b',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    const parsed = JSON.parse(jsonText) as {
      edges: Array<{ fromTicketId: string; toTicketId: string; reason: string; confidence: string }>;
      riskSummary: string;
    };

    const aiEdges: DependencyEdge[] = (parsed.edges || [])
      .filter(e => e.fromTicketId && e.toTicketId)
      .map(e => ({
        fromTicketId: e.fromTicketId,
        toTicketId: e.toTicketId,
        reason: e.reason || 'AI-detected dependency',
        confidence: (['low', 'medium', 'high'].includes(e.confidence) ? e.confidence : 'low') as DependencyEdge['confidence'],
        source: 'ai' as const,
      }));

    return { edges: aiEdges, riskSummary: parsed.riskSummary || '' };
  } catch {
    return { edges: [], riskSummary: 'Unable to generate risk summary' };
  }
}

export async function analyzeDependencies(projectId: string): Promise<DependencyAnalysisResult> {
  const allTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  const workingTickets = allTickets.filter(t => t.status !== 'done');

  if (workingTickets.length === 0) {
    return {
      projectId,
      totalTickets: 0,
      dependencyCount: 0,
      criticalBlockers: [],
      allBlockers: [],
      edges: [],
      riskSummary: 'No active tickets to analyze.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // Heuristic edges
  const heuristicEdges = buildHeuristicEdges(workingTickets);

  // AI edges (non-blocking)
  let aiEdges: DependencyEdge[] = [];
  let riskSummary = '';

  try {
    const aiResult = await callAIForDependencies(projectId, workingTickets);
    aiEdges = aiResult.edges;
    riskSummary = aiResult.riskSummary;
  } catch {
    // Only set error summary if there are heuristic edges
    if (heuristicEdges.length > 0) {
      riskSummary = 'Unable to generate risk summary';
    }
  }

  // Merge and deduplicate
  const edgeKey = (e: DependencyEdge) => `${e.fromTicketId}->${e.toTicketId}`;
  const edgeMap = new Map<string, DependencyEdge>();

  for (const edge of heuristicEdges) {
    edgeMap.set(edgeKey(edge), edge);
  }
  for (const edge of aiEdges) {
    if (!edgeMap.has(edgeKey(edge))) {
      edgeMap.set(edgeKey(edge), edge);
    }
  }

  const allEdges = [...edgeMap.values()];
  const { blockers, criticalBlockers } = computeBlockerInfo(workingTickets, allEdges);
  const allBlockers = [...blockers.values()].sort((a, b) => b.blockerScore - a.blockerScore);

  if (!riskSummary && allEdges.length === 0) {
    riskSummary = 'No dependencies detected';
  }

  return {
    projectId,
    totalTickets: workingTickets.length,
    dependencyCount: allEdges.length,
    criticalBlockers,
    allBlockers,
    edges: allEdges,
    riskSummary,
    analyzedAt: new Date().toISOString(),
  };
}
