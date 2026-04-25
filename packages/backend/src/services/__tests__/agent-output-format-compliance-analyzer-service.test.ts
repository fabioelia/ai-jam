import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputFormatComplianceAnalyzer } from '../agent-output-format-compliance-analyzer-service.js';

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

describe('analyzeAgentOutputFormatComplianceAnalyzer', () => {
  it('empty sessions → empty metrics, scores=0', async () => {
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgComplianceScore).toBe(0);
    expect(report.highViolationAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgComplianceScore).toBe('number');
    expect(typeof report.highViolationAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('avgComplianceScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgComplianceScore).toBeGreaterThanOrEqual(0);
      expect(m.avgComplianceScore).toBeLessThanOrEqual(100);
    }
  });

  it('complianceRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('b', 0, { status: 'error', durationMs: 0 })]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(m.complianceRate).toBeGreaterThanOrEqual(0);
      expect(m.complianceRate).toBeLessThanOrEqual(100);
    }
  });

  it('partialComplianceRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(m.partialComplianceRate).toBeGreaterThanOrEqual(0);
      expect(m.partialComplianceRate).toBeLessThanOrEqual(100);
    }
  });

  it('metrics sorted descending by avgComplianceScore', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => makeSession('a', i)),
      ...Array.from({ length: 5 }, (_, i) => makeSession('b', i, { status: 'error', durationMs: 0 })),
      ...Array.from({ length: 5 }, (_, i) => makeSession('c', i)),
    ]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].avgComplianceScore).toBeGreaterThanOrEqual(report.metrics[i].avgComplianceScore);
    }
  });

  it('rating: excellent when avgComplianceScore >= 80', async () => {
    (db.limit as any).mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => makeSession('agent-x', i))
    );
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      if (m.avgComplianceScore >= 80) expect(m.rating).toBe('excellent');
    }
  });

  it('rating: poor when avgComplianceScore < 40', async () => {
    const allError = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-bad', i, { status: 'error', durationMs: 0 })
    );
    (db.limit as any).mockResolvedValueOnce(allError);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      if (m.avgComplianceScore < 40) expect(m.rating).toBe('poor');
    }
  });

  it('rating values are valid', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('trend: improving when recent completed rate > older rate + 5', async () => {
    const olderSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-t', i + 20, { status: 'error', durationMs: 0, createdAt: new Date(Date.now() - (i + 20) * 60000) })
    );
    const recentSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-t', i, { status: 'completed', durationMs: 5000, createdAt: new Date(Date.now() - i * 60000) })
    );
    (db.limit as any).mockResolvedValueOnce([...olderSessions, ...recentSessions]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'agent-t');
    expect(m?.trend).toBe('improving');
  });

  it('trend: degrading when recent completed rate < older rate - 5', async () => {
    const olderSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-d', i + 20, { status: 'completed', durationMs: 5000, createdAt: new Date(Date.now() - (i + 20) * 60000) })
    );
    const recentSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-d', i, { status: 'error', durationMs: 0, createdAt: new Date(Date.now() - i * 60000) })
    );
    (db.limit as any).mockResolvedValueOnce([...olderSessions, ...recentSessions]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'agent-d');
    expect(m?.trend).toBe('degrading');
  });

  it('trend values are valid', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('highViolationAgents counts agents with complianceRate < 70', async () => {
    const goodSessions = Array.from({ length: 5 }, (_, i) => makeSession('good', i));
    const badSessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('bad', i, { status: 'error', durationMs: 0 })
    );
    (db.limit as any).mockResolvedValueOnce([...goodSessions, ...badSessions]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    const expected = report.metrics.filter(m => m.complianceRate < 70).length;
    expect(report.highViolationAgents).toBe(expected);
  });

  it('fleetAvgComplianceScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => makeSession('a', i)),
      ...Array.from({ length: 5 }, (_, i) => makeSession('b', i)),
    ]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    expect(report.fleetAvgComplianceScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgComplianceScore).toBeLessThanOrEqual(100);
  });

  it('mostCommonViolation is a non-empty string', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(typeof m.mostCommonViolation).toBe('string');
      expect(m.mostCommonViolation.length).toBeGreaterThan(0);
    }
  });

  it('formatViolations is a non-negative integer', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentOutputFormatComplianceAnalyzer();
    for (const m of report.metrics) {
      expect(m.formatViolations).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.formatViolations)).toBe(true);
    }
  });
});
