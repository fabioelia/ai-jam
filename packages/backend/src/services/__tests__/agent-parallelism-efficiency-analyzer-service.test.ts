import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentParallelismEfficiencyAnalyzer } from '../agent-parallelism-efficiency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, statusOverride?: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
    status: statusOverride ?? 'completed',
    durationMs: 1800000,
  }));
}

function makeClusteredSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 10000),
    completedAt: new Date(Date.now() - i * 10000 + 5000),
    startedAt: new Date(Date.now() - i * 10000),
    status: 'completed',
    durationMs: 5000,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentParallelismEfficiencyAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgParallelismScore');
    expect(report).toHaveProperty('highIdleAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    expect(report.metrics).toEqual([]);
    expect(report.fleetAvgParallelismScore).toBe(0);
    expect(report.highIdleAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('loner', 1));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgParallelismScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    expect(report.fleetAvgParallelismScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgParallelismScore).toBeLessThanOrEqual(100);
  });

  it('parallelismScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('b1', 5));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.parallelismScore).toBeGreaterThanOrEqual(0);
      expect(m.parallelismScore).toBeLessThanOrEqual(100);
    }
  });

  it('parallelismRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('b2', 5));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.parallelismRate).toBeGreaterThanOrEqual(0);
      expect(m.parallelismRate).toBeLessThanOrEqual(100);
    }
  });

  it('idleGapRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c1', 4));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.idleGapRate).toBeGreaterThanOrEqual(0);
      expect(m.idleGapRate).toBeLessThanOrEqual(100);
    }
  });

  it('maxConcurrentSessions >= 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c2', 4));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.maxConcurrentSessions).toBeGreaterThanOrEqual(1);
    }
  });

  it('avgConcurrentSessions >= 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c3', 4));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgConcurrentSessions).toBeGreaterThanOrEqual(1);
    }
  });

  it('sorts metrics by parallelismScore descending', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('d1', 3), ...makeSessions('d2', 3), ...makeSessions('d3', 3)]);
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].parallelismScore).toBeLessThanOrEqual(report.metrics[i - 1].parallelismScore);
    }
  });

  it('trend is one of valid values', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('e1', 5));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('trend improving when recent sessions more clustered', async () => {
    const older = Array.from({ length: 10 }, (_, i) => ({
      id: `s-old-${i}`,
      agentId: 'trend-agent',
      agentName: 'Trend Agent',
      createdAt: new Date(Date.now() - (20 + i) * 3600000),
      completedAt: new Date(Date.now() - (20 + i) * 3600000 + 1000),
      startedAt: new Date(Date.now() - (20 + i) * 3600000),
      status: 'completed',
      durationMs: 1000,
    }));
    const recent = Array.from({ length: 10 }, (_, i) => ({
      id: `s-new-${i}`,
      agentId: 'trend-agent',
      agentName: 'Trend Agent',
      createdAt: new Date(Date.now() - i * 5000),
      completedAt: new Date(Date.now() - i * 5000 + 1000),
      startedAt: new Date(Date.now() - i * 5000),
      status: 'completed',
      durationMs: 1000,
    }));
    (db.limit as any).mockResolvedValue([...older, ...recent]);
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    const m = report.metrics.find(x => x.agentId === 'trend-agent');
    expect(m?.trend).toBe('improving');
  });

  it('rating excellent when score >= 80', async () => {
    (db.limit as any).mockResolvedValue(makeClusteredSessions('high', 20));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    for (const m of report.metrics) {
      if (m.parallelismScore >= 80) expect(m.rating).toBe('excellent');
    }
  });

  it('highIdleAgents counts agents with idleGapRate > 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('idle1', 4), ...makeSessions('idle2', 4)]);
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    const expected = report.metrics.filter(m => m.idleGapRate > 50).length;
    expect(report.highIdleAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('f1', 3));
    const report = await analyzeAgentParallelismEfficiencyAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });
});
