import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzePerformanceTrends } from './agent-performance-trend-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

const now = Date.now();
const RECENT = new Date(now - 3 * 24 * 60 * 60 * 1000);   // 3d ago — recent window, stale
const BASELINE = new Date(now - 15 * 24 * 60 * 60 * 1000); // 15d ago — baseline window, stale
const CREATED = new Date(now - 20 * 24 * 60 * 60 * 1000);  // just a createdAt anchor

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  updatedAt: Date,
  createdAt: Date = CREATED,
) {
  return { id, status, assignedPersona, updatedAt, createdAt };
}

function mockSelect(rows: any[]) {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

describe('analyzePerformanceTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty agentTrends when no tickets in window', async () => {
    mockSelect([]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends).toEqual([]);
    expect(report.totalAgents).toBe(0);
  });

  it('agent with < 2 tickets in recent window → insufficient_data', async () => {
    // 1 recent ticket, 3 baseline tickets
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
      makeTicket('b3', 'AgentA', 'done', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].trendDirection).toBe('insufficient_data');
  });

  it('completionRate delta >= +0.1 → improving', async () => {
    // Recent: 3/3 done = 1.0, Baseline: 2/4 done = 0.5 → delta = +0.5
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('r2', 'AgentA', 'done', RECENT),
      makeTicket('r3', 'AgentA', 'done', RECENT),
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
      makeTicket('b3', 'AgentA', 'in_progress', BASELINE),
      makeTicket('b4', 'AgentA', 'in_progress', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].trendDirection).toBe('improving');
    expect(report.improvingAgents).toBe(1);
  });

  it('completionRate delta <= -0.1 → declining', async () => {
    // Recent: 1/4 done = 0.25, Baseline: 4/4 done = 1.0 → delta = -0.75
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('r2', 'AgentA', 'in_progress', RECENT),
      makeTicket('r3', 'AgentA', 'in_progress', RECENT),
      makeTicket('r4', 'AgentA', 'in_progress', RECENT),
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
      makeTicket('b3', 'AgentA', 'done', BASELINE),
      makeTicket('b4', 'AgentA', 'done', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].trendDirection).toBe('declining');
    expect(report.decliningAgents).toBe(1);
  });

  it('stallRate delta >= +0.1 → declining even if completionRate stable', async () => {
    // Recent: 2/4 done = 0.5 completionRate, 2/4 stalled = 0.5 stallRate
    // Baseline: 3/6 done = 0.5 completionRate, 1/6 stalled ≈ 0.167 stallRate (2 cancelled → not stalled)
    // completionRateDelta = 0, stallRateDelta ≈ +0.333 → declining
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('r2', 'AgentA', 'done', RECENT),
      makeTicket('r3', 'AgentA', 'in_progress', RECENT), // stale → stalled
      makeTicket('r4', 'AgentA', 'in_progress', RECENT), // stale → stalled
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
      makeTicket('b3', 'AgentA', 'done', BASELINE),
      makeTicket('b4', 'AgentA', 'in_progress', BASELINE), // stalled (1 stall)
      makeTicket('b5', 'AgentA', 'cancelled', BASELINE),   // not stalled (cancelled)
      makeTicket('b6', 'AgentA', 'cancelled', BASELINE),   // not stalled (cancelled)
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].trendDirection).toBe('declining');
  });

  it('both deltas within ±0.1 and sufficient data → stable', async () => {
    // Recent: 2/4 done = 0.5, 2 stalled → stallRate 0.5
    // Baseline: 2/4 done = 0.5, 2 stalled → stallRate 0.5
    // deltas = 0 → stable
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('r2', 'AgentA', 'done', RECENT),
      makeTicket('r3', 'AgentA', 'in_progress', RECENT),
      makeTicket('r4', 'AgentA', 'in_progress', RECENT),
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
      makeTicket('b3', 'AgentA', 'in_progress', BASELINE),
      makeTicket('b4', 'AgentA', 'in_progress', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].trendDirection).toBe('stable');
    expect(report.stableAgents).toBe(1);
  });

  it('sort order: declining before stable before improving', async () => {
    // AgentA: declining (completionRate drops)
    // AgentB: stable (same rates)
    // AgentC: improving (completionRate rises)
    mockSelect([
      // AgentC improving: recent 3/3, baseline 1/3
      makeTicket('c1', 'AgentC', 'done', RECENT),
      makeTicket('c2', 'AgentC', 'done', RECENT),
      makeTicket('c3', 'AgentC', 'done', RECENT),
      makeTicket('c4', 'AgentC', 'done', BASELINE),
      makeTicket('c5', 'AgentC', 'in_progress', BASELINE),
      makeTicket('c6', 'AgentC', 'in_progress', BASELINE),
      // AgentB stable: same 2/4 in each window
      makeTicket('b1', 'AgentB', 'done', RECENT),
      makeTicket('b2', 'AgentB', 'done', RECENT),
      makeTicket('b3', 'AgentB', 'in_progress', RECENT),
      makeTicket('b4', 'AgentB', 'in_progress', RECENT),
      makeTicket('b5', 'AgentB', 'done', BASELINE),
      makeTicket('b6', 'AgentB', 'done', BASELINE),
      makeTicket('b7', 'AgentB', 'in_progress', BASELINE),
      makeTicket('b8', 'AgentB', 'in_progress', BASELINE),
      // AgentA declining: recent 1/4, baseline 4/4
      makeTicket('a1', 'AgentA', 'done', RECENT),
      makeTicket('a2', 'AgentA', 'in_progress', RECENT),
      makeTicket('a3', 'AgentA', 'in_progress', RECENT),
      makeTicket('a4', 'AgentA', 'in_progress', RECENT),
      makeTicket('a5', 'AgentA', 'done', BASELINE),
      makeTicket('a6', 'AgentA', 'done', BASELINE),
      makeTicket('a7', 'AgentA', 'done', BASELINE),
      makeTicket('a8', 'AgentA', 'done', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    const directions = report.agentTrends.map((t) => t.trendDirection);
    expect(directions[0]).toBe('declining');
    expect(directions[1]).toBe('stable');
    expect(directions[2]).toBe('improving');
  });

  it('uses fallback recommendation on AI error', async () => {
    mockSelect([
      makeTicket('r1', 'AgentA', 'done', RECENT),
      makeTicket('r2', 'AgentA', 'done', RECENT),
      makeTicket('b1', 'AgentA', 'done', BASELINE),
      makeTicket('b2', 'AgentA', 'done', BASELINE),
    ]);
    const report = await analyzePerformanceTrends('proj-1');
    expect(report.agentTrends[0].recommendation).toBe(
      'Monitor this agent closely and review ticket assignments for the next sprint.',
    );
  });
});
