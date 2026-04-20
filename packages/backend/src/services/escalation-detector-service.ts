import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface StaleTicket {
  ticketId: string;
  title: string;
  priority: string;
  status: string;
  staleDays: number;
  assignedPersona: string | null;
  riskLevel: 'critical' | 'high' | 'medium';
  recommendation: string;
}

export interface EscalationReport {
  projectId: string;
  staleTickets: StaleTicket[];
  totalStale: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  analyzedAt: string;
}

const STALE_THRESHOLDS: Record<string, number> = {
  backlog: 7,
  todo: 7,
  in_progress: 3,
  review: 2,
  qa: 2,
};

function getStaleThreshold(status: string): number | null {
  return STALE_THRESHOLDS[status] ?? null;
}

function classifyRisk(
  priority: string,
  staleDays: number,
  threshold: number,
): 'critical' | 'high' | 'medium' {
  const isCriticalPriority = priority === 'critical';
  const isHighPriority = priority === 'high';

  if (isCriticalPriority) {
    return 'critical';
  }

  if (isHighPriority) {
    return 'high';
  }

  // critical/high priority AND staleDays > threshold × 2
  if ((isCriticalPriority || isHighPriority) && staleDays > threshold * 2) {
    return 'high';
  }

  return 'medium';
}

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2 };

export async function detectEscalations(projectId: string): Promise<EscalationReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      priority: tickets.priority,
      status: tickets.status,
      storyPoints: tickets.storyPoints,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const now = Date.now();

  // Filter to non-done statuses and compute staleDays
  const candidateTickets = allTickets
    .filter((t) => t.status !== 'done' && t.status !== 'acceptance')
    .map((t) => {
      const updatedAt = t.updatedAt ? new Date(t.updatedAt).getTime() : now;
      const staleDays = Math.floor((now - updatedAt) / 86400000);
      return { ...t, staleDays };
    });

  // Find stale tickets
  const staleRaw = candidateTickets.filter((t) => {
    const threshold = getStaleThreshold(t.status as string);
    if (threshold == null) return false;
    return t.staleDays > threshold;
  });

  if (staleRaw.length === 0) {
    return {
      projectId,
      staleTickets: [],
      totalStale: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      analyzedAt: new Date().toISOString(),
    };
  }

  // Classify risk levels
  const classified = staleRaw.map((t) => {
    const threshold = getStaleThreshold(t.status as string)!;
    const riskLevel = classifyRisk(t.priority as string, t.staleDays, threshold);
    return {
      ticketId: t.id,
      title: t.title,
      priority: t.priority as string,
      status: t.status as string,
      staleDays: t.staleDays,
      assignedPersona: t.assignedPersona as string | null,
      riskLevel,
      description: t.description,
    };
  });

  // Get AI recommendations via single batched OpenRouter call
  const recommendations: Map<string, string> = new Map();
  const fallback = 'Consider reassigning or breaking this ticket into smaller sub-tasks';

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const ticketLines = classified
      .map(
        (t, i) =>
          `${i + 1}. Title: "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | Stale: ${t.staleDays} days | Assigned: ${t.assignedPersona ?? 'Unassigned'} | Description: ${t.description ?? 'N/A'}`,
      )
      .join('\n');

    const prompt = `You are an AI project management assistant. For each stale ticket below, recommend ONE specific unblock action (re-assign to another agent, break into sub-tasks, escalate priority, or request review). Be concise — one sentence per ticket.

Stale tickets:
${ticketLines}

Respond with exactly ${classified.length} lines, one recommendation per line, numbered to match the tickets above. No extra text.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) {
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      classified.forEach((t, i) => {
        const line = lines[i];
        if (line) {
          // Strip leading numbering like "1." or "1) "
          const cleaned = line.replace(/^\d+[.)]\s*/, '').trim();
          if (cleaned) {
            recommendations.set(t.ticketId, cleaned);
          }
        }
      });
    }
  } catch (e) {
    console.warn('Escalation detector AI recommendation failed, using fallback:', e);
  }

  // Build final stale tickets with recommendations
  const staleTickets: StaleTicket[] = classified.map((t) => ({
    ticketId: t.ticketId,
    title: t.title,
    priority: t.priority,
    status: t.status,
    staleDays: t.staleDays,
    assignedPersona: t.assignedPersona,
    riskLevel: t.riskLevel,
    recommendation: recommendations.get(t.ticketId) ?? fallback,
  }));

  // Sort: critical → high → medium, then staleDays descending within tier
  staleTickets.sort((a, b) => {
    const riskDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.staleDays - a.staleDays;
  });

  const criticalCount = staleTickets.filter((t) => t.riskLevel === 'critical').length;
  const highCount = staleTickets.filter((t) => t.riskLevel === 'high').length;
  const mediumCount = staleTickets.filter((t) => t.riskLevel === 'medium').length;

  return {
    projectId,
    staleTickets,
    totalStale: staleTickets.length,
    criticalCount,
    highCount,
    mediumCount,
    analyzedAt: new Date().toISOString(),
  };
}
