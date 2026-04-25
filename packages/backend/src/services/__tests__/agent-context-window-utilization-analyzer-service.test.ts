import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentContextWindowUtilization } from '../agent-context-window-utilization-analyzer-service.js';

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

describe('analyzeAgentContextWindowUtilization', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentContextWindowUtilization();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgUtilizationPct');
    expect(report).toHaveProperty('criticalUtilizationAgents');
    expect(report).toHaveProperty('efficientAgents');
    expect(report).toHaveProperty('utilizationDistribution');
    expect(report).toHaveProperty('criticalSessions');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgUtilizationPct is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 3));
    const report = await analyzeAgentContextWindowUtilization();
    expect(report.fleetAvgUtilizationPct).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgUtilizationPct).toBeLessThanOrEqual(100);
  });

  it('criticalUtilizationAgents counts agents with avgUtilizationPct >= 85', async () => {
    const sessions = [...makeSessions('agent-b', 4), ...makeSessions('agent-c', 4)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentContextWindowUtilization();
    const expected = report.metrics.filter(m => m.avgUtilizationPct >= 85).length;
    expect(report.criticalUtilizationAgents).toBe(expected);
  });

  it('efficientAgents counts agents with avgUtilizationPct < 40', async () => {
    const sessions = [...makeSessions('agent-d', 4), ...makeSessions('agent-e', 4)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentContextWindowUtilization();
    const expected = report.metrics.filter(m => m.avgUtilizationPct < 40).length;
    expect(report.efficientAgents).toBe(expected);
  });

  it('avgUtilizationPct is in 0-100 per metric', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 3));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      expect(m.avgUtilizationPct).toBeGreaterThanOrEqual(0);
      expect(m.avgUtilizationPct).toBeLessThanOrEqual(100);
    }
  });

  it('peakUtilizationPct is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      expect(m.peakUtilizationPct).toBeGreaterThanOrEqual(0);
      expect(m.peakUtilizationPct).toBeLessThanOrEqual(100);
    }
  });

  it('truncationEvents is >= 0', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 3));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      expect(m.truncationEvents).toBeGreaterThanOrEqual(0);
    }
  });

  it('utilizationTrend is one of increasing|stable|decreasing', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 4));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      expect(['increasing', 'stable', 'decreasing']).toContain(m.utilizationTrend);
    }
  });

  it('utilizationLevel correct for bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 4));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      const expected =
        m.avgUtilizationPct >= 85 ? 'critical' :
        m.avgUtilizationPct >= 65 ? 'high' :
        m.avgUtilizationPct >= 40 ? 'moderate' : 'efficient';
      expect(m.utilizationLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentContextWindowUtilization();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by avgUtilizationPct', async () => {
    const sessions = [
      ...makeSessions('agent-k', 5),
      ...makeSessions('agent-l', 4),
      ...makeSessions('agent-m', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentContextWindowUtilization();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].avgUtilizationPct).toBeLessThanOrEqual(report.metrics[i - 1].avgUtilizationPct);
    }
  });

  it('utilizationDistribution has 4 buckets', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentContextWindowUtilization();
    expect(report.utilizationDistribution).toHaveLength(4);
  });

  it('recommendations is non-empty array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentContextWindowUtilization();
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('empty sessions returns empty metrics array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentContextWindowUtilization();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgUtilizationPct).toBe(0);
  });

  it('peakUtilizationPct >= avgUtilizationPct per metric', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-n', 4));
    const report = await analyzeAgentContextWindowUtilization();
    for (const m of report.metrics) {
      expect(m.peakUtilizationPct).toBeGreaterThanOrEqual(m.avgUtilizationPct);
    }
  });
});
