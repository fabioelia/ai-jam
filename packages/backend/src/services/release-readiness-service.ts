import { db } from '../db/connection.js';
import { projects, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface ReadinessCheck {
  name: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

export interface ReleaseReadinessResult {
  projectId: string;
  featureId?: string;
  verdict: 'ready' | 'not_ready' | 'conditional';
  checks: ReadinessCheck[];
  totalTickets: number;
  doneTickets: number;
  completionPercent: number;
  narrative: string;
  topConcern: string;
  analyzedAt: string;
}

function extractJSONFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

export async function checkReleaseReadiness(
  projectId: string,
  featureId?: string,
): Promise<ReleaseReadinessResult | null> {
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projectRows.length === 0) return null;
  const project = projectRows[0];

  const allTickets = featureId
    ? await db.select().from(tickets).where(eq(tickets.featureId, featureId))
    : await db.select().from(tickets).where(eq(tickets.projectId, projectId));

  const now = new Date();
  const totalTickets = allTickets.length;
  const doneStatuses = ['done', 'review'];

  const doneTickets = allTickets.filter((t) => doneStatuses.includes(t.status as string)).length;
  const completionPercent = totalTickets > 0 ? (doneTickets / totalTickets) * 100 : 0;

  // AllDone (blocking): all tickets in done or review
  const inProgressCount = allTickets.filter((t) => !doneStatuses.includes(t.status as string)).length;
  const allDoneCheck: ReadinessCheck = {
    name: 'AllDone',
    passed: inProgressCount === 0,
    blocking: true,
    detail: inProgressCount > 0 ? `${inProgressCount} tickets still in progress` : 'All tickets complete',
  };

  // NoCriticalBlockers (blocking): no critical priority tickets outside done/review
  const criticalOpen = allTickets.filter(
    (t) => (t.priority as string) === 'critical' && !doneStatuses.includes(t.status as string),
  ).length;
  const noCriticalBlockersCheck: ReadinessCheck = {
    name: 'NoCriticalBlockers',
    passed: criticalOpen === 0,
    blocking: true,
    detail: criticalOpen > 0 ? `${criticalOpen} critical blockers open` : 'No critical blockers',
  };

  // DependenciesResolved (non-blocking): always pass, heuristic only
  const depsCheck: ReadinessCheck = {
    name: 'DependenciesResolved',
    passed: true,
    blocking: false,
    detail: 'No dependency data available',
  };

  // QualityThreshold (non-blocking): avg quality >= 60%
  let avgQuality = 100;
  if (totalTickets > 0) {
    const totalScore = allTickets.reduce((sum, t) => {
      let score = 0;
      if (t.description && (t.description as string).length > 0) score++;
      const ac = t.acceptanceCriteria as unknown[];
      if (Array.isArray(ac) && ac.length > 0) score++;
      if (t.storyPoints != null && (t.storyPoints as number) > 0) score++;
      return sum + (score / 3) * 100;
    }, 0);
    avgQuality = totalScore / totalTickets;
  }
  const qualityCheck: ReadinessCheck = {
    name: 'QualityThreshold',
    passed: avgQuality >= 60,
    blocking: false,
    detail: `Avg quality ${Math.round(avgQuality)}%`,
  };

  // NoOverdueTickets (non-blocking): no ticket with dueDate < now and status not done
  const overdueCount = allTickets.filter((t) => {
    const dueDate = (t as Record<string, unknown>).dueDate;
    if (!dueDate) return false;
    return new Date(dueDate as string) < now && !doneStatuses.includes(t.status as string);
  }).length;
  const noOverdueCheck: ReadinessCheck = {
    name: 'NoOverdueTickets',
    passed: overdueCount === 0,
    blocking: false,
    detail: overdueCount > 0 ? `${overdueCount} overdue tickets` : 'No overdue tickets',
  };

  const checks = [allDoneCheck, noCriticalBlockersCheck, depsCheck, qualityCheck, noOverdueCheck];

  const blockingFailed = checks.filter((c) => c.blocking && !c.passed);
  const nonBlockingFailed = checks.filter((c) => !c.blocking && !c.passed);

  let verdict: ReleaseReadinessResult['verdict'];
  if (blockingFailed.length > 0) {
    verdict = 'not_ready';
  } else if (nonBlockingFailed.length > 0) {
    verdict = 'conditional';
  } else {
    verdict = 'ready';
  }

  let narrative = '';
  let topConcern = '';

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const failingChecks = checks.filter((c) => !c.passed).map((c) => c.name).join(', ') || 'None';
    const prompt = `Release readiness assessment for project "${project.name}":
- Verdict: ${verdict}
- Completion: ${doneTickets}/${totalTickets} tickets done (${Math.round(completionPercent)}%)
- Failing checks: ${failingChecks}
- Check details: ${checks.map((c) => `${c.name}: ${c.passed ? 'PASS' : 'FAIL'} — ${c.detail}`).join('; ')}

Return ONLY JSON:
{"narrative": "<2-3 sentence release assessment>", "topConcern": "<top concern or None>"}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = extractJSONFromText(content);
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as { narrative: string; topConcern: string };
      narrative = parsed.narrative || '';
      topConcern = parsed.topConcern || 'None';
    }
  } catch (e) {
    console.warn('Release readiness AI failed:', e);
    narrative = 'AI unavailable — heuristic assessment based on checklist results';
    topConcern = checks.find((c) => !c.passed)?.name || 'None';
  }

  return {
    projectId,
    featureId,
    verdict,
    checks,
    totalTickets,
    doneTickets,
    completionPercent: Math.round(completionPercent * 10) / 10,
    narrative,
    topConcern,
    analyzedAt: now.toISOString(),
  };
}
