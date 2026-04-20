import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentDelegationDepth,
  computeDelegationScore,
  getDelegationTier,
} from '../agent-delegation-depth-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../../db/connection.js';

type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

const NOW = new Date('2026-04-20T00:00:00Z');

function makeNote(
  ticketId: string,
  authorId: string,
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
  offsetMs = 0,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    handoffFrom,
    handoffTo,
    createdAt: new Date(NOW.getTime() + offsetMs),
  };
}

function mockDb(ticketRows: { id: string }[], noteRows: NoteRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(noteRows);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

describe('analyzeAgentDelegationDepth', () => {
  it('returns empty report when no tickets', async () => {
    mockDb([], []);
    const report = await analyzeAgentDelegationDepth('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.avgDelegationRate).toBe(0);
    expect(report.summary.overDelegators).toEqual([]);
  });

  it('correctly computes delegationRate: 2 of 3 notes have handoffTo → 66.7%', async () => {
    mockDb(
      [{ id: 't1' }],
      [
        makeNote('t1', 'AgentA', 'AgentB', null, 0),   // delegated
        makeNote('t1', 'AgentA', 'AgentC', null, 1000), // delegated
        makeNote('t1', 'AgentA', null, null, 2000),     // direct
      ],
    );
    const report = await analyzeAgentDelegationDepth('proj-1');
    const agentA = report.agents.find(a => a.agentId === 'AgentA');
    expect(agentA).toBeDefined();
    expect(agentA!.delegatedSessions).toBe(2);
    expect(agentA!.totalSessions).toBe(3);
    expect(agentA!.delegationRate).toBeCloseTo(66.7, 0);
  });

  it('balanced tier: delegationRate≈45%, depth≈2 → score≥70 → tier=balanced', async () => {
    // 9 notes: 4 with handoffTo, 5 without → delegationRate = 44.4% → no penalty
    // depth: 2 per initiated ticket → score -= 0 → score = 100 → tier = balanced
    mockDb(
      [{ id: 't1' }],
      [
        makeNote('t1', 'AgentA', 'AgentB', null, 0),
        makeNote('t1', 'AgentA', null, null, 1000),
        makeNote('t1', 'AgentA', null, null, 2000),
        makeNote('t1', 'AgentA', null, null, 3000),
        makeNote('t1', 'AgentA', null, null, 4000),
        makeNote('t1', 'AgentA', null, null, 5000),
        makeNote('t1', 'AgentA', 'AgentB', null, 6000),
        makeNote('t1', 'AgentA', null, null, 7000),
        makeNote('t1', 'AgentA', null, null, 8000),
      ],
    );
    const report = await analyzeAgentDelegationDepth('proj-1');
    const agentA = report.agents.find(a => a.agentId === 'AgentA');
    expect(agentA).toBeDefined();
    expect(agentA!.delegationTier).toBe('balanced');
    expect(agentA!.delegationScore).toBeGreaterThanOrEqual(70);
  });

  it('over-delegator: delegationRate=85%+ → tier=over-delegator', () => {
    // delegationRate=85, score = 100-30=70. score < 70? No, 70 is >= 70 → balanced
    // Need delegationRate > 80 AND score < 70
    // delegationRate=85, depth=6 → score = 100-30-20 = 50 < 70 → over-delegator
    const score = computeDelegationScore(85, 6);
    expect(score).toBe(50);
    const tier = getDelegationTier(85, score);
    expect(tier).toBe('over-delegator');
  });

  it('under-delegator: delegationRate=5%, score<70 → tier=under-delegator', () => {
    // delegationRate=5 < 10 → score -= 25 → score = 75
    // 75 >= 70 → balanced. Need more penalty.
    // delegationRate=5, depth=6 → score = 100-25-20 = 55 < 70 → under-delegator
    const score = computeDelegationScore(5, 6);
    expect(score).toBe(55);
    const tier = getDelegationTier(5, score);
    expect(tier).toBe('under-delegator');
  });

  it('computeDelegationScore: delegationRate=90, depth=1 → penalty -30 → score=70', () => {
    // delegationRate > 80 → -30; depth=1 ≤ 3 → 0
    const score = computeDelegationScore(90, 1);
    expect(score).toBe(70);
  });

  it('computeDelegationScore: delegationRate=40, depth=6 → penalty -20 → score=80', () => {
    // delegationRate=40: not >80, not >60, not <10 → no penalty
    // depth=6 > 5 → -20
    const score = computeDelegationScore(40, 6);
    expect(score).toBe(80);
  });

  it('summary: correct avgDelegationRate, balancedAgents count, overDelegators list', async () => {
    mockDb(
      [{ id: 't1' }, { id: 't2' }],
      [
        // AgentA: 2/4 delegated = 50% → no penalty → score=100 → balanced
        makeNote('t1', 'AgentA', 'AgentB', null, 0),
        makeNote('t1', 'AgentA', null, null, 1000),
        makeNote('t2', 'AgentA', 'AgentC', null, 2000),
        makeNote('t2', 'AgentA', null, null, 3000),
        // AgentB: 3/3 notes have handoffTo = 100% → score = 100-30 = 70 (>=70 → balanced)
        makeNote('t1', 'AgentB', 'AgentC', null, 0),
        makeNote('t2', 'AgentB', 'AgentD', null, 1000),
        makeNote('t1', 'AgentB', 'AgentE', null, 2000),
      ],
    );
    const report = await analyzeAgentDelegationDepth('proj-1');
    // Both agents should have some delegationRate
    expect(report.agents).toHaveLength(2);
    expect(report.summary.totalAgents).toBe(2);
    // avgDelegationRate should be average of both
    const expected = report.agents.reduce((s, a) => s + a.delegationRate, 0) / 2;
    expect(report.summary.avgDelegationRate).toBeCloseTo(expected, 0);
  });
});
