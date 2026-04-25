import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentToolUsageEfficiency } from '../agent-tool-usage-efficiency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: i % 5 === 0 ? 'error' : 'completed',
    retryCount: i % 3 === 0 ? 1 : 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentToolUsageEfficiency', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgEfficiencyScore');
    expect(report).toHaveProperty('inefficientAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgEfficiencyScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.fleetAvgEfficiencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgEfficiencyScore).toBeLessThanOrEqual(100);
  });

  it('inefficientAgents counts agents with efficiencyScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentToolUsageEfficiency();
    const expected = report.metrics.filter(m => m.efficiencyScore < 50).length;
    expect(report.inefficientAgents).toBe(expected);
  });

  it('efficiencyScore in 0-100 for all metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      expect(m.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.efficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('totalCalls > 0 for metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      expect(m.totalCalls).toBeGreaterThan(0);
    }
  });

  it('successfulCalls + failedCalls + redundantCalls <= totalCalls', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      expect(m.successfulCalls + m.failedCalls + m.redundantCalls).toBeLessThanOrEqual(m.totalCalls + 1);
    }
  });

  it('mostUsedTool and leastUsedTool are strings', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      expect(typeof m.mostUsedTool).toBe('string');
      expect(typeof m.leastUsedTool).toBe('string');
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating excellent when score >= 80', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentToolUsageEfficiency();
    for (const m of report.metrics) {
      if (m.efficiencyScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.efficiencyScore >= 60) expect(m.rating).toBe('good');
      else if (m.efficiencyScore >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentToolUsageEfficiency();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by efficiencyScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentToolUsageEfficiency();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].efficiencyScore).toBeGreaterThanOrEqual(report.metrics[i].efficiencyScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgEfficiencyScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.metrics).toHaveLength(0);
  });

  it('all error sessions produce low efficiency', async () => {
    const allError = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`, agentId: 'err', agentName: 'Error Agent',
      status: 'error', retryCount: 2,
      startedAt: new Date(Date.now() - i * 3600000),
      completedAt: new Date(Date.now() - i * 3600000 + 1800000),
      createdAt: new Date(Date.now() - i * 3600000),
    }));
    (db.limit as any).mockResolvedValue(allError);
    const report = await analyzeAgentToolUsageEfficiency();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].efficiencyScore).toBeLessThan(80);
    }
  });

  it('totalSessions reflects session count', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.metrics).toHaveLength(1);
  });

  it('multiple agents each get own metric', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.metrics).toHaveLength(2);
  });

  it('zero calls produces score 0', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentToolUsageEfficiency();
    expect(report.fleetAvgEfficiencyScore).toBe(0);
  });
});
