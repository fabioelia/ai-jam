import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentDependencyRisk } from '../agent-dependency-risk-analyzer-service.js';

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
  return Array.from({ length: count }, (_, i) => ({
    id: `sess-${agentId}-${i}`,
    agentId,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentDependencyRisk', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDependencyRisk();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRiskScore');
    expect(report).toHaveProperty('criticalRiskAgents');
    expect(report).toHaveProperty('singlePointsOfFailure');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgRiskScore is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDependencyRisk();
    expect(report.fleetAvgRiskScore).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentDependencyRisk();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentDependencyRisk();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgRiskScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentDependencyRisk();
    expect(report.fleetAvgRiskScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgRiskScore).toBeLessThanOrEqual(100);
  });

  it('riskScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentDependencyRisk();
    for (const m of report.metrics) {
      expect(m.riskScore).toBeGreaterThanOrEqual(0);
      expect(m.riskScore).toBeLessThanOrEqual(100);
    }
  });

  it('concentrationIndex in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentDependencyRisk();
    for (const m of report.metrics) {
      expect(m.concentrationIndex).toBeGreaterThanOrEqual(0);
      expect(m.concentrationIndex).toBeLessThanOrEqual(100);
    }
  });

  it('uniqueDependencies >= 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentDependencyRisk();
    for (const m of report.metrics) {
      expect(m.uniqueDependencies).toBeGreaterThanOrEqual(1);
    }
  });

  it('riskLevel correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentDependencyRisk();
    for (const m of report.metrics) {
      if (m.riskScore >= 75) expect(m.riskLevel).toBe('critical');
      else if (m.riskScore >= 55) expect(m.riskLevel).toBe('high');
      else if (m.riskScore >= 35) expect(m.riskLevel).toBe('moderate');
      else expect(m.riskLevel).toBe('low');
    }
  });

  it('riskTrend is one of increasing | stable | decreasing', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentDependencyRisk();
    const valid = ['increasing', 'stable', 'decreasing'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.riskTrend);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDependencyRisk();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by riskScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentDependencyRisk();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].riskScore).toBeLessThanOrEqual(report.metrics[i - 1].riskScore);
    }
  });

  it('criticalRiskAgents counts agents with riskLevel === critical', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentDependencyRisk();
    const expected = report.metrics.filter(m => m.riskLevel === 'critical').length;
    expect(report.criticalRiskAgents).toBe(expected);
  });

  it('singlePointsOfFailure counts agents with concentrationIndex >= 80', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentDependencyRisk();
    const expected = report.metrics.filter(m => m.concentrationIndex >= 80).length;
    expect(report.singlePointsOfFailure).toBe(expected);
  });
});
