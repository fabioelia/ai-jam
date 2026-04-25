import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentResourceEfficiency } from '../agent-resource-efficiency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

const mockDb = await import('../../db/connection.js');

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  (mockDb.db.select as any).mockReturnThis();
  (mockDb.db.from as any).mockReturnThis();
  (mockDb.db.orderBy as any).mockReturnThis();
});

describe('analyzeAgentResourceEfficiency', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentResourceEfficiency();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgEfficiencyScore');
    expect(report).toHaveProperty('wastefulAgents');
    expect(report).toHaveProperty('optimalAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgEfficiencyScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 4));
    const report = await analyzeAgentResourceEfficiency();
    expect(report.fleetAvgEfficiencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgEfficiencyScore).toBeLessThanOrEqual(100);
  });

  it('wastefulAgents counts agents with efficiencyScore < 40', async () => {
    const sessions = [
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResourceEfficiency();
    const expected = report.metrics.filter(m => m.efficiencyScore < 40).length;
    expect(report.wastefulAgents).toBe(expected);
  });

  it('optimalAgents counts agents with efficiencyScore >= 80', async () => {
    const sessions = [
      ...makeSessions('agent-d', 5),
      ...makeSessions('agent-e', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResourceEfficiency();
    const expected = report.metrics.filter(m => m.efficiencyScore >= 80).length;
    expect(report.optimalAgents).toBe(expected);
  });

  it('tokensPerTask is positive', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 3));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      expect(m.tokensPerTask).toBeGreaterThan(0);
    }
  });

  it('redundantCallRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      expect(m.redundantCallRate).toBeGreaterThanOrEqual(0);
      expect(m.redundantCallRate).toBeLessThanOrEqual(100);
    }
  });

  it('outputToResourceRatio is positive', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 3));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      expect(m.outputToResourceRatio).toBeGreaterThan(0);
    }
  });

  it('sessionOverheadRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 3));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      expect(m.sessionOverheadRate).toBeGreaterThanOrEqual(0);
      expect(m.sessionOverheadRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving|stable|degrading', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 4));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('efficiencyLevel correct for score bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-k', 4));
    const report = await analyzeAgentResourceEfficiency();
    for (const m of report.metrics) {
      const expected =
        m.efficiencyScore >= 80 ? 'optimal' :
        m.efficiencyScore >= 60 ? 'efficient' :
        m.efficiencyScore >= 40 ? 'moderate' : 'wasteful';
      expect(m.efficiencyLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentResourceEfficiency();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by efficiencyScore', async () => {
    const sessions = [
      ...makeSessions('agent-l', 5),
      ...makeSessions('agent-m', 4),
      ...makeSessions('agent-n', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResourceEfficiency();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].efficiencyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].efficiencyScore);
    }
  });
});
