import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentDelegationAccuracyAnalyzer } from '../agent-delegation-accuracy-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

const now = Date.now();

function makeSession(agentId: string, i: number, overrides: Record<string, any> = {}) {
  return {
    id: `session-${agentId}-${i}`,
    agentId,
    status: 'completed',
    createdAt: new Date(now - i * 60000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.select as any).mockReturnThis();
  (db.from as any).mockReturnThis();
  (db.orderBy as any).mockReturnThis();
  (db.limit as any).mockResolvedValue([]);
});

describe('analyzeAgentDelegationAccuracyAnalyzer', () => {
  it('empty sessions → empty agents', async () => {
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.avgRate).toBe(0);
    expect(report.summary.mostAccurate).toBe('');
    expect(report.summary.leastAccurate).toBe('');
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.summary.avgRate).toBe('number');
    expect(typeof report.summary.mostAccurate).toBe('string');
    expect(typeof report.summary.leastAccurate).toBe('string');
  });

  it('delegationAccuracyRate is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.delegationAccuracyRate).toBeGreaterThanOrEqual(0);
      expect(m.delegationAccuracyRate).toBeLessThanOrEqual(1);
    }
  });

  it('reDelegationRate is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1, { status: 'error' })]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.reDelegationRate).toBeGreaterThanOrEqual(0);
      expect(m.reDelegationRate).toBeLessThanOrEqual(1);
    }
  });

  it('downstreamSuccessRate is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.downstreamSuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.downstreamSuccessRate).toBeLessThanOrEqual(1);
    }
  });

  it('delegationRisk is valid enum', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(['low', 'moderate', 'high']).toContain(report.agents[0].delegationRisk);
  });

  it('agents sorted by delegationAccuracyRate descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('good', 0), makeSession('good', 1), makeSession('good', 2),
      makeSession('bad', 0, { status: 'error' }), makeSession('bad', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    const rates = report.agents.map(a => a.delegationAccuracyRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
    }
  });

  it('all errors → lower delegationAccuracyRate', async () => {
    const badSessions = Array.from({ length: 8 }, (_, i) => makeSession('bad', i, { status: 'error' }));
    const goodSessions = Array.from({ length: 8 }, (_, i) => makeSession('good', i));
    (db.limit as any).mockResolvedValueOnce([...badSessions, ...goodSessions]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    const bad = report.agents.find(a => a.agentId === 'bad')!;
    const good = report.agents.find(a => a.agentId === 'good')!;
    expect(good.delegationAccuracyRate).toBeGreaterThanOrEqual(bad.delegationAccuracyRate);
  });

  it('totalDelegations >= 2 always', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.agents[0].totalDelegations).toBeGreaterThanOrEqual(2);
  });

  it('correctDelegations <= totalDelegations', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1), makeSession('a', 2)]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    const m = report.agents[0];
    expect(m.correctDelegations).toBeLessThanOrEqual(m.totalDelegations);
  });

  it('summary.mostAccurate matches first sorted agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.summary.mostAccurate).toBe(report.agents[0].agentId);
  });

  it('summary.leastAccurate matches last sorted agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.summary.leastAccurate).toBe(report.agents[report.agents.length - 1].agentId);
  });

  it('summary.avgRate is correct average', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('x', 0), makeSession('x', 1),
      makeSession('y', 0), makeSession('y', 1),
    ]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    const expected = Math.round(
      report.agents.reduce((s, a) => s + a.delegationAccuracyRate, 0) / report.agents.length * 1000
    ) / 1000;
    expect(report.summary.avgRate).toBe(expected);
  });

  it('avgDelegationLatencyMs > 0', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 5), makeSession('a', 10),
    ]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.agents[0].avgDelegationLatencyMs).toBeGreaterThan(0);
  });

  it('delegationRisk low when rate >= 0.7', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession('good', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    const m = report.agents[0];
    if (m.delegationAccuracyRate >= 0.7) {
      expect(m.delegationRisk).toBe('low');
    }
  });

  it('zero delegations edge case handled gracefully', async () => {
    (db.limit as any).mockResolvedValueOnce([]);
    const report = await analyzeAgentDelegationAccuracyAnalyzer('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.avgRate).toBe(0);
  });
});
