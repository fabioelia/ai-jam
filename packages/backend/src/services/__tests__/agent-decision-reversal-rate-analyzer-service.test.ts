import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentDecisionReversalRateAnalyzer } from '../agent-decision-reversal-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, status = 'completed') {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
    status,
    durationMs: 1800000,
  }));
}

function makeErrorThenRetry(agentId: string) {
  return [
    {
      id: `${agentId}-error`,
      agentId,
      agentName: agentId,
      createdAt: new Date(Date.now() - 10000),
      completedAt: new Date(Date.now() - 9000),
      startedAt: new Date(Date.now() - 10000),
      status: 'error',
      durationMs: 1000,
    },
    {
      id: `${agentId}-retry`,
      agentId,
      agentName: agentId,
      createdAt: new Date(Date.now() - 5000),
      completedAt: new Date(Date.now() - 4000),
      startedAt: new Date(Date.now() - 5000),
      status: 'completed',
      durationMs: 1000,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentDecisionReversalRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgStabilityScore');
    expect(report).toHaveProperty('highReversalAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    expect(report.metrics).toEqual([]);
    expect(report.fleetAvgStabilityScore).toBe(0);
    expect(report.highReversalAgents).toBe(0);
  });

  it('fleetAvgStabilityScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    expect(report.fleetAvgStabilityScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgStabilityScore).toBeLessThanOrEqual(100);
  });

  it('stabilityScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('b1', 5));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(m.stabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('reversalRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('b2', 5));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.reversalRate).toBeGreaterThanOrEqual(0);
      expect(m.reversalRate).toBeLessThanOrEqual(100);
    }
  });

  it('abandonmentRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c1', 4, 'error'));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.abandonmentRate).toBeGreaterThanOrEqual(0);
      expect(m.abandonmentRate).toBeLessThanOrEqual(100);
    }
  });

  it('totalReversals >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c2', 4));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.totalReversals).toBeGreaterThanOrEqual(0);
    }
  });

  it('avgReversalsPerSession >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c3', 4));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgReversalsPerSession).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects reversals from error followed by retry', async () => {
    (db.limit as any).mockResolvedValue(makeErrorThenRetry('reversal-agent'));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'reversal-agent');
    expect(m?.totalReversals).toBeGreaterThan(0);
  });

  it('sorts metrics by stabilityScore descending', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('d1', 3), ...makeSessions('d2', 3), ...makeSessions('d3', 3)]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].stabilityScore).toBeLessThanOrEqual(report.metrics[i - 1].stabilityScore);
    }
  });

  it('trend is one of valid values', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('e1', 5));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('trend improving when recent error rate lower than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) => ({
      id: `old-${i}`,
      agentId: 'trend-a',
      agentName: 'Trend A',
      createdAt: new Date(Date.now() - (20 + i) * 3600000),
      status: 'error',
      durationMs: 1000,
    }));
    const recent = Array.from({ length: 10 }, (_, i) => ({
      id: `new-${i}`,
      agentId: 'trend-a',
      agentName: 'Trend A',
      createdAt: new Date(Date.now() - i * 3600000),
      status: 'completed',
      durationMs: 1000,
    }));
    (db.limit as any).mockResolvedValue([...older, ...recent]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'trend-a');
    expect(m?.trend).toBe('improving');
  });

  it('trend degrading when recent error rate higher than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) => ({
      id: `old-${i}`,
      agentId: 'trend-b',
      agentName: 'Trend B',
      createdAt: new Date(Date.now() - (20 + i) * 3600000),
      status: 'completed',
      durationMs: 1000,
    }));
    const recent = Array.from({ length: 10 }, (_, i) => ({
      id: `new-${i}`,
      agentId: 'trend-b',
      agentName: 'Trend B',
      createdAt: new Date(Date.now() - i * 3600000),
      status: 'error',
      durationMs: 1000,
    }));
    (db.limit as any).mockResolvedValue([...older, ...recent]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'trend-b');
    expect(m?.trend).toBe('degrading');
  });

  it('rating excellent when stabilityScore >= 80', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('excel', 5));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    for (const m of report.metrics) {
      if (m.stabilityScore >= 80) expect(m.rating).toBe('excellent');
    }
  });

  it('highReversalAgents counts agents with reversalRate > 30', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('h1', 4), ...makeSessions('h2', 4)]);
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    const expected = report.metrics.filter(m => m.reversalRate > 30).length;
    expect(report.highReversalAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('f1', 3));
    const report = await analyzeAgentDecisionReversalRateAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });
});
