import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCapabilityBoundaryAwarenessAnalyzer } from '../agent-capability-boundary-awareness-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, i: number, overrides: Record<string, any> = {}) {
  return {
    id: `session-${agentId}-${i}`,
    agentId,
    status: 'completed',
    durationMs: 5000,
    createdAt: new Date(Date.now() - i * 60000),
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

describe('analyzeAgentCapabilityBoundaryAwarenessAnalyzer', () => {
  it('empty sessions → empty metrics, scores=0', async () => {
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgBoundaryAwarenessScore).toBe(0);
    expect(report.poorBoundaryAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgBoundaryAwarenessScore).toBe('number');
    expect(typeof report.poorBoundaryAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('boundaryAwarenessScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.boundaryAwarenessScore).toBeGreaterThanOrEqual(0);
      expect(m.boundaryAwarenessScore).toBeLessThanOrEqual(100);
    }
  });

  it('overreachRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0, { status: 'error', durationMs: 10000 }),
      makeSession('a', 1),
    ]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.overreachRate).toBeGreaterThanOrEqual(0);
      expect(m.overreachRate).toBeLessThanOrEqual(100);
    }
  });

  it('underreachRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.underreachRate).toBeGreaterThanOrEqual(0);
      expect(m.underreachRate).toBeLessThanOrEqual(100);
    }
  });

  it('appropriateRoutingRate >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.appropriateRoutingRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('metrics sorted descending by boundaryAwarenessScore', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => makeSession('a', i)),
      ...Array.from({ length: 5 }, (_, i) => makeSession('b', i, { status: 'error', durationMs: 10000 })),
      ...Array.from({ length: 5 }, (_, i) => makeSession('c', i)),
    ]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].boundaryAwarenessScore).toBeGreaterThanOrEqual(report.metrics[i].boundaryAwarenessScore);
    }
  });

  it('trend: improving when recent completed rate > older rate + 5', async () => {
    const older = Array.from({ length: 10 }, (_, i) =>
      makeSession('t', i + 20, { status: 'error', durationMs: 10000, createdAt: new Date(Date.now() - (i + 20) * 60000) })
    );
    const recent = Array.from({ length: 10 }, (_, i) =>
      makeSession('t', i, { status: 'completed', durationMs: 5000, createdAt: new Date(Date.now() - i * 60000) })
    );
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    const m = report.metrics.find(x => x.agentId === 't');
    expect(m?.trend).toBe('improving');
  });

  it('trend: degrading when recent completed rate < older rate - 5', async () => {
    const older = Array.from({ length: 10 }, (_, i) =>
      makeSession('d', i + 20, { status: 'completed', durationMs: 5000, createdAt: new Date(Date.now() - (i + 20) * 60000) })
    );
    const recent = Array.from({ length: 10 }, (_, i) =>
      makeSession('d', i, { status: 'error', durationMs: 10000, createdAt: new Date(Date.now() - i * 60000) })
    );
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'd');
    expect(m?.trend).toBe('degrading');
  });

  it('trend: stable when rates are similar', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession('s', i, { createdAt: new Date(Date.now() - i * 60000) })
    );
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    const m = report.metrics.find(x => x.agentId === 's');
    expect(m?.trend).toBe('stable');
  });

  it('rating: excellent when boundaryAwarenessScore >= 80', async () => {
    (db.limit as any).mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => makeSession('x', i))
    );
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      if (m.boundaryAwarenessScore >= 80) expect(m.rating).toBe('excellent');
    }
  });

  it('rating values are valid', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('poorBoundaryAgents counts agents with boundaryAwarenessScore < 50', async () => {
    const good = Array.from({ length: 5 }, (_, i) => makeSession('good', i));
    const bad = Array.from({ length: 5 }, (_, i) =>
      makeSession('bad', i, { status: 'error', durationMs: 10000 })
    );
    (db.limit as any).mockResolvedValueOnce([...good, ...bad]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    const expected = report.metrics.filter(m => m.boundaryAwarenessScore < 50).length;
    expect(report.poorBoundaryAgents).toBe(expected);
  });

  it('fleetAvgBoundaryAwarenessScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => makeSession('a', i)),
      ...Array.from({ length: 5 }, (_, i) => makeSession('b', i)),
    ]);
    const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
    expect(report.fleetAvgBoundaryAwarenessScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgBoundaryAwarenessScore).toBeLessThanOrEqual(100);
  });
});
