import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface ConcurrencyBucket {
  concurrencyLevel: number;
  ticketCount: number;
  avgCompletionMs: number;
  reworkRate: number;
  handoffSuccessRate: number;
}

export interface AgentMultitaskingProfile {
  personaId: string;
  avgConcurrency: number;
  peakConcurrency: number;
  optimalConcurrency: number;
  efficiencyScore: number; // 0-100
  concurrencyBuckets: ConcurrencyBucket[];
  overloadedPct: number;
  efficiencyTier: 'optimal' | 'acceptable' | 'degraded' | 'overloaded';
}

export interface MultitaskingEfficiencyReport {
  agents: AgentMultitaskingProfile[];
  systemAvgConcurrency: number;
  mostEfficientAgent: string;
  mostOverloadedAgent: string;
  recommendedMaxConcurrency: number;
  aiSummary?: string;
  recommendations?: string[];
}

const DONE_STATUSES = new Set(['done']);
const REWORK_STATUSES = new Set(['backlog', 'in_progress']);
const ACTIVE_STATUSES = new Set(['in_progress', 'review', 'qa', 'acceptance']);

function computeEfficiencyScore(
  bucket: ConcurrencyBucket,
  maxAvgCompletionMs: number,
): number {
  const normalisedSpeed =
    maxAvgCompletionMs > 0
      ? (1 - bucket.avgCompletionMs / maxAvgCompletionMs) * 100
      : 100;
  return (
    bucket.handoffSuccessRate * 0.5 +
    (100 - bucket.reworkRate) * 0.3 +
    normalisedSpeed * 0.2
  );
}

function efficiencyTierFromScore(
  score: number,
): AgentMultitaskingProfile['efficiencyTier'] {
  if (score >= 80) return 'optimal';
  if (score >= 60) return 'acceptable';
  if (score >= 40) return 'degraded';
  return 'overloaded';
}

export async function analyzeMultitaskingEfficiency(
  projectId: string,
): Promise<MultitaskingEfficiencyReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) {
    return {
      agents: [],
      systemAvgConcurrency: 0,
      mostEfficientAgent: '',
      mostOverloadedAgent: '',
      recommendedMaxConcurrency: 1,
    };
  }

  // Group tickets by persona
  type TicketRecord = {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  const agentTickets = new Map<string, TicketRecord[]>();

  for (const ticket of allTickets) {
    const persona = ticket.assignedPersona as string | null;
    if (!persona) continue;
    if (!agentTickets.has(persona)) agentTickets.set(persona, []);
    agentTickets.get(persona)!.push({
      id: ticket.id,
      status: ticket.status as string,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  }

  if (agentTickets.size === 0) {
    return {
      agents: [],
      systemAvgConcurrency: 0,
      mostEfficientAgent: '',
      mostOverloadedAgent: '',
      recommendedMaxConcurrency: 1,
    };
  }

  const agentProfiles: AgentMultitaskingProfile[] = [];

  for (const [personaId, personaTickets] of agentTickets.entries()) {
    // For each ticket, estimate its concurrency level at the time it was being worked on.
    // We use createdAt/updatedAt as a working window and count overlaps.
    const concurrencyPerTicket: { ticket: TicketRecord; concurrency: number }[] =
      [];

    for (const ticket of personaTickets) {
      const start = new Date(ticket.createdAt).getTime();
      const end = new Date(ticket.updatedAt).getTime();
      // Count how many other tickets overlapped with this ticket's window
      let overlap = 0;
      for (const other of personaTickets) {
        if (other.id === ticket.id) continue;
        const oStart = new Date(other.createdAt).getTime();
        const oEnd = new Date(other.updatedAt).getTime();
        if (oStart <= end && oEnd >= start) {
          overlap++;
        }
      }
      // concurrency = number of simultaneous tickets (including self)
      concurrencyPerTicket.push({ ticket, concurrency: overlap + 1 });
    }

    const concurrencyValues = concurrencyPerTicket.map((c) => c.concurrency);
    const avgConcurrency =
      concurrencyValues.reduce((a, b) => a + b, 0) / concurrencyValues.length;
    const peakConcurrency = Math.max(...concurrencyValues);

    // Group by concurrency level
    const bucketMap = new Map<
      number,
      {
        completionMsList: number[];
        reworkCount: number;
        handoffSuccessCount: number;
        total: number;
      }
    >();

    for (const { ticket, concurrency } of concurrencyPerTicket) {
      if (!bucketMap.has(concurrency)) {
        bucketMap.set(concurrency, {
          completionMsList: [],
          reworkCount: 0,
          handoffSuccessCount: 0,
          total: 0,
        });
      }
      const bucket = bucketMap.get(concurrency)!;
      bucket.total++;

      const completionMs =
        new Date(ticket.updatedAt).getTime() -
        new Date(ticket.createdAt).getTime();
      bucket.completionMsList.push(Math.max(0, completionMs));

      // Rework = ticket moved back to backlog or in_progress from further along
      if (REWORK_STATUSES.has(ticket.status)) {
        bucket.reworkCount++;
      }

      // Handoff success = ticket completed (done)
      if (DONE_STATUSES.has(ticket.status)) {
        bucket.handoffSuccessCount++;
      }
    }

    const concurrencyBuckets: ConcurrencyBucket[] = [];
    for (const [concurrencyLevel, data] of bucketMap.entries()) {
      const avgCompletionMs =
        data.completionMsList.reduce((a, b) => a + b, 0) /
        data.completionMsList.length;
      const reworkRate = (data.reworkCount / data.total) * 100;
      const handoffSuccessRate = (data.handoffSuccessCount / data.total) * 100;
      concurrencyBuckets.push({
        concurrencyLevel,
        ticketCount: data.total,
        avgCompletionMs,
        reworkRate,
        handoffSuccessRate,
      });
    }

    // Sort buckets by concurrency level
    concurrencyBuckets.sort((a, b) => a.concurrencyLevel - b.concurrencyLevel);

    // Compute efficiency scores for each bucket
    const maxAvgCompletionMs = Math.max(
      ...concurrencyBuckets.map((b) => b.avgCompletionMs),
    );

    const bucketScores = concurrencyBuckets.map((bucket) => ({
      bucket,
      score: computeEfficiencyScore(bucket, maxAvgCompletionMs),
    }));

    // Optimal concurrency = bucket with highest efficiency score
    const bestBucket = bucketScores.reduce(
      (best, curr) => (curr.score > best.score ? curr : best),
      bucketScores[0],
    );

    const optimalConcurrency = bestBucket.bucket.concurrencyLevel;
    const efficiencyScore = Math.round(
      Math.min(100, Math.max(0, bestBucket.score)),
    );

    // Overloaded pct = % of tickets worked above optimalConcurrency
    const totalTickets = concurrencyPerTicket.length;
    const overloadedTickets = concurrencyPerTicket.filter(
      (c) => c.concurrency > optimalConcurrency,
    ).length;
    const overloadedPct =
      totalTickets > 0 ? (overloadedTickets / totalTickets) * 100 : 0;

    const efficiencyTier = efficiencyTierFromScore(efficiencyScore);

    agentProfiles.push({
      personaId,
      avgConcurrency: Math.round(avgConcurrency * 10) / 10,
      peakConcurrency,
      optimalConcurrency,
      efficiencyScore,
      concurrencyBuckets,
      overloadedPct: Math.round(overloadedPct * 10) / 10,
      efficiencyTier,
    });
  }

  const systemAvgConcurrency =
    agentProfiles.length > 0
      ? agentProfiles.reduce((a, b) => a + b.avgConcurrency, 0) /
        agentProfiles.length
      : 0;

  const mostEfficientAgent = agentProfiles.reduce(
    (best, curr) => (curr.efficiencyScore > best.efficiencyScore ? curr : best),
    agentProfiles[0],
  ).personaId;

  const mostOverloadedAgent = agentProfiles.reduce(
    (worst, curr) =>
      curr.overloadedPct > worst.overloadedPct ? curr : worst,
    agentProfiles[0],
  ).personaId;

  const recommendedMaxConcurrency = Math.max(
    1,
    Math.floor(
      agentProfiles.reduce((a, b) => a + b.optimalConcurrency, 0) /
        agentProfiles.length,
    ),
  );

  // AI summary via OpenRouter
  let aiSummary: string | undefined;
  let recommendations: string[] | undefined;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentLines = agentProfiles
      .map(
        (a) =>
          `Agent: ${a.personaId}, avgConcurrency: ${a.avgConcurrency}, peakConcurrency: ${a.peakConcurrency}, optimalConcurrency: ${a.optimalConcurrency}, efficiencyScore: ${a.efficiencyScore}, overloadedPct: ${a.overloadedPct}%, tier: ${a.efficiencyTier}`,
      )
      .join('\n');

    const prompt = `You are an AI project efficiency analyst. Analyze the following agent multi-tasking data and produce a brief JSON summary. Output ONLY a JSON object with keys "aiSummary" (string, 2-3 sentences) and "recommendations" (array of 2-3 string action items). No other text.

System avg concurrency: ${Math.round(systemAvgConcurrency * 10) / 10}
Most efficient agent: ${mostEfficientAgent}
Most overloaded agent: ${mostOverloadedAgent}
Recommended max concurrency: ${recommendedMaxConcurrency}

Agent profiles:
${agentLines}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.aiSummary) aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.recommendations))
        recommendations = parsed.recommendations;
    }
  } catch (e) {
    console.warn(
      'Agent multitasking efficiency AI analysis failed, using fallback:',
      e,
    );
  }

  return {
    agents: agentProfiles,
    systemAvgConcurrency: Math.round(systemAvgConcurrency * 10) / 10,
    mostEfficientAgent,
    mostOverloadedAgent,
    recommendedMaxConcurrency,
    aiSummary,
    recommendations,
  };
}
