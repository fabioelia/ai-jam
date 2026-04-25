import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentProactiveInitiativeRateAnalyzer } from '../agent-proactive-initiative-rate-analyzer-service.js';

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
    startedAt: new Date(now - i * 60000 - 5000),
    completedAt: new Date(now - i * 60000),
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

describe('analyzeAgentProactiveInitiativeRateAnalyzer', () => {
  it('empty sessions → empty metrics, scores=0', async () => {
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgInitiativeScore).toBe(0);
    expect(report.reactiveAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgInitiativeScore).toBe('number');
    expect(typeof report.reactiveAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('returns analysisTimestamp as ISO string', async () => {
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('initiativeScore is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1), makeSession('a', 2),
    ]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.initiativeScore).toBeGreaterThanOrEqual(0);
      expect(m.initiativeScore).toBeLessThanOrEqual(100);
    }
  });

  it('initiativeRate is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('b', 0)]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.initiativeRate).toBeGreaterThanOrEqual(0);
      expect(m.initiativeRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgInitiativesPerSession >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics[0].avgInitiativesPerSession).toBeGreaterThanOrEqual(0);
  });

  it('sorts metrics by initiativeScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('low', 0, { status: 'error' }),
      makeSession('low', 1, { status: 'error' }),
      makeSession('high', 0),
      makeSession('high', 1),
      makeSession('high', 2),
    ]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    const scores = report.metrics.map(m => m.initiativeScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('trend stable when similar recent and older', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession('a', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics[0].trend).toBe('stable');
  });

  it('trend improving when recent better than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) =>
      makeSession('a', 20 - i, { status: 'error' })
    );
    const recent = Array.from({ length: 10 }, (_, i) =>
      makeSession('a', 9 - i)
    );
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics[0].trend).toBe('improving');
  });

  it('trend degrading when recent worse than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) => makeSession('a', 20 - i));
    const recent = Array.from({ length: 10 }, (_, i) =>
      makeSession('a', 9 - i, { status: 'error' })
    );
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics[0].trend).toBe('degrading');
  });

  it('rating excellent when score >= 80', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession('a', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    const m = report.metrics[0];
    if (m.initiativeScore >= 80) expect(m.rating).toBe('excellent');
    else expect(['good', 'fair', 'poor']).toContain(m.rating);
  });

  it('rating poor when score < 40', async () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('a', i, { status: 'error', startedAt: null, completedAt: null })
    );
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    const m = report.metrics[0];
    if (m.initiativeScore < 40) expect(m.rating).toBe('poor');
  });

  it('reactiveAgents counts agents with initiativeScore < 40', async () => {
    const sessions = [
      makeSession('low1', 0, { status: 'error', startedAt: null, completedAt: null }),
      makeSession('low1', 1, { status: 'error', startedAt: null, completedAt: null }),
      makeSession('high1', 0),
      makeSession('high1', 1),
      makeSession('high1', 2),
    ];
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    const expectedReactive = report.metrics.filter(m => m.initiativeScore < 40).length;
    expect(report.reactiveAgents).toBe(expectedReactive);
  });

  it('fleetAvgInitiativeScore is average of all agent scores', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    const expected = Math.round(
      report.metrics.reduce((sum, m) => sum + m.initiativeScore, 0) / report.metrics.length
    );
    expect(report.fleetAvgInitiativeScore).toBe(expected);
  });

  it('highValueInitiatives >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
    expect(report.metrics[0].highValueInitiatives).toBeGreaterThanOrEqual(0);
  });
});
