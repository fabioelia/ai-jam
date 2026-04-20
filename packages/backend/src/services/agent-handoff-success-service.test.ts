import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeHandoffSuccess } from './agent-handoff-success-service.js';

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

function makeTicket(
  id: string,
  status: string,
  assignedPersona: string | null,
  epicId: string | null = null,
  createdAt: Date = new Date('2026-01-01'),
  updatedAt: Date = new Date('2026-01-01'),
) {
  return { id, status, assignedPersona, epicId, createdAt, updatedAt };
}

function setupDb(ticketRows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(ticketRows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeHandoffSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty pairs when no multi-agent epics exist', async () => {
    // All tickets same agent in same epic
    setupDb([
      makeTicket('t1', 'done', 'AgentA', 'epic-1', new Date('2026-01-01')),
      makeTicket('t2', 'done', 'AgentA', 'epic-1', new Date('2026-01-02')),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toEqual([]);
    expect(report.totalPairs).toBe(0);
  });

  it('skips self-handoffs (fromAgent === toAgent)', async () => {
    setupDb([
      makeTicket('t1', 'done', 'AgentA', 'epic-1', new Date('2026-01-01')),
      makeTicket('t2', 'in_progress', 'AgentA', 'epic-1', new Date('2026-01-02')),
      makeTicket('t3', 'done', 'AgentA', 'epic-1', new Date('2026-01-03')),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toEqual([]);
  });

  it('skips pairs with totalHandoffs < 2', async () => {
    // Only 1 handoff from AgentA to AgentB
    setupDb([
      makeTicket('t1', 'done', 'AgentA', 'epic-1', new Date('2026-01-01')),
      makeTicket('t2', 'done', 'AgentB', 'epic-1', new Date('2026-01-02')),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toEqual([]);
  });

  it('excellent rating when successRate >= 0.80', async () => {
    // 4 handoffs AgentA→AgentB: 4 done = 100% success
    setupDb([
      makeTicket('t0', 'done', 'AgentA', 'epic-1', new Date('2026-01-01')),
      makeTicket('t1', 'done', 'AgentB', 'epic-1', new Date('2026-01-02')),
      makeTicket('t2', 'done', 'AgentA', 'epic-2', new Date('2026-01-01')),
      makeTicket('t3', 'done', 'AgentB', 'epic-2', new Date('2026-01-02')),
      makeTicket('t4', 'done', 'AgentA', 'epic-3', new Date('2026-01-01')),
      makeTicket('t5', 'done', 'AgentB', 'epic-3', new Date('2026-01-02')),
      makeTicket('t6', 'done', 'AgentA', 'epic-4', new Date('2026-01-01')),
      makeTicket('t7', 'done', 'AgentB', 'epic-4', new Date('2026-01-02')),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0].rating).toBe('excellent');
    expect(report.pairs[0].successRate).toBe(1.0);
  });

  it('good rating when successRate >= 0.60 and < 0.80', async () => {
    // 5 handoffs AgentA→AgentB: 3 done, 2 in_progress (not stalled) = 60%
    const recentDate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    setupDb([
      makeTicket('ta', 'done', 'AgentA', 'epic-1', new Date('2026-01-01')),
      makeTicket('tb', 'done', 'AgentB', 'epic-1', new Date('2026-01-02'), recentDate),
      makeTicket('tc', 'done', 'AgentA', 'epic-2', new Date('2026-01-01')),
      makeTicket('td', 'done', 'AgentB', 'epic-2', new Date('2026-01-02'), recentDate),
      makeTicket('te', 'done', 'AgentA', 'epic-3', new Date('2026-01-01')),
      makeTicket('tf', 'done', 'AgentB', 'epic-3', new Date('2026-01-02'), recentDate),
      makeTicket('tg', 'done', 'AgentA', 'epic-4', new Date('2026-01-01')),
      makeTicket('th', 'in_progress', 'AgentB', 'epic-4', new Date('2026-01-02'), recentDate),
      makeTicket('ti', 'done', 'AgentA', 'epic-5', new Date('2026-01-01')),
      makeTicket('tj', 'in_progress', 'AgentB', 'epic-5', new Date('2026-01-02'), recentDate),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0].rating).toBe('good');
    expect(report.pairs[0].successRate).toBe(0.6);
  });

  it('poor rating when successRate >= 0.30 and < 0.60', async () => {
    // 4 handoffs: 1 done, 3 in_progress (not stalled) = 25% — wait that's critical
    // 4 handoffs: 2 done, 2 in_progress = 50% = poor
    const recentDate = new Date(Date.now() - 10 * 60 * 1000);
    setupDb([
      makeTicket('ta', 'done', 'AgentA', 'e1', new Date('2026-01-01')),
      makeTicket('tb', 'done', 'AgentB', 'e1', new Date('2026-01-02'), recentDate),
      makeTicket('tc', 'done', 'AgentA', 'e2', new Date('2026-01-01')),
      makeTicket('td', 'done', 'AgentB', 'e2', new Date('2026-01-02'), recentDate),
      makeTicket('te', 'done', 'AgentA', 'e3', new Date('2026-01-01')),
      makeTicket('tf', 'in_progress', 'AgentB', 'e3', new Date('2026-01-02'), recentDate),
      makeTicket('tg', 'done', 'AgentA', 'e4', new Date('2026-01-01')),
      makeTicket('th', 'in_progress', 'AgentB', 'e4', new Date('2026-01-02'), recentDate),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0].rating).toBe('poor');
    expect(report.pairs[0].successRate).toBe(0.5);
  });

  it('critical rating when successRate < 0.30', async () => {
    // 4 handoffs: 1 done = 25% = critical
    const recentDate = new Date(Date.now() - 10 * 60 * 1000);
    setupDb([
      makeTicket('ta', 'done', 'AgentA', 'e1', new Date('2026-01-01')),
      makeTicket('tb', 'done', 'AgentB', 'e1', new Date('2026-01-02'), recentDate),
      makeTicket('tc', 'done', 'AgentA', 'e2', new Date('2026-01-01')),
      makeTicket('td', 'in_progress', 'AgentB', 'e2', new Date('2026-01-02'), recentDate),
      makeTicket('te', 'done', 'AgentA', 'e3', new Date('2026-01-01')),
      makeTicket('tf', 'in_progress', 'AgentB', 'e3', new Date('2026-01-02'), recentDate),
      makeTicket('tg', 'done', 'AgentA', 'e4', new Date('2026-01-01')),
      makeTicket('th', 'in_progress', 'AgentB', 'e4', new Date('2026-01-02'), recentDate),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0].rating).toBe('critical');
    expect(report.pairs[0].successRate).toBe(0.25);
  });

  it('uses fallback recommendation on AI error', async () => {
    // AI mock already rejects; need >=2 handoffs with poor/critical rating to trigger batch
    const oldDate = new Date(Date.now() - 80 * 60 * 60 * 1000); // 80h ago
    setupDb([
      makeTicket('ta', 'done', 'AgentA', 'e1', new Date('2026-01-01')),
      makeTicket('tb', 'in_progress', 'AgentB', 'e1', new Date('2026-01-02'), oldDate),
      makeTicket('tc', 'done', 'AgentA', 'e2', new Date('2026-01-01')),
      makeTicket('td', 'in_progress', 'AgentB', 'e2', new Date('2026-01-02'), oldDate),
      makeTicket('te', 'done', 'AgentA', 'e3', new Date('2026-01-01')),
      makeTicket('tf', 'in_progress', 'AgentB', 'e3', new Date('2026-01-02'), oldDate),
      makeTicket('tg', 'done', 'AgentA', 'e4', new Date('2026-01-01')),
      makeTicket('th', 'in_progress', 'AgentB', 'e4', new Date('2026-01-02'), oldDate),
    ]);
    const report = await analyzeHandoffSuccess('proj-1');
    expect(report.pairs[0].recommendation).toBe(
      'Improve handoff context by adding detailed ticket descriptions and linking to relevant epics.'
    );
  });
});
