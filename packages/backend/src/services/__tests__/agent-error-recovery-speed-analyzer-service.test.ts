import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentErrorRecoverySpeed } from '../agent-error-recovery-speed-analyzer-service.js';

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

describe('analyzeAgentErrorRecoverySpeed', () => {
  it('returns valid report shape with empty sessions', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRecoveryScore');
    expect(report).toHaveProperty('criticalAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with only 1 session', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-solo', 1));
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agent with 2+ sessions', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 3));
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentId).toBe('agent-a');
  });

  it('fleetAvgRecoveryScore is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-b', 4));
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(report.fleetAvgRecoveryScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgRecoveryScore).toBeLessThanOrEqual(100);
  });

  it('criticalAgents counts recoveryScore < 40', async () => {
    const sessions = [
      ...makeSessions('agent-c', 5),
      ...makeSessions('agent-d', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentErrorRecoverySpeed();
    const expectedCritical = report.metrics.filter(m => m.recoveryScore < 40).length;
    expect(report.criticalAgents).toBe(expectedCritical);
  });

  it('avgRecoveryTimeMs > 0', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-e', 3));
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      expect(m.avgRecoveryTimeMs).toBeGreaterThan(0);
    }
  });

  it('recoverySuccessRate is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 4));
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      expect(m.recoverySuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.recoverySuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('errorRecurrenceRate is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      expect(m.errorRecurrenceRate).toBeGreaterThanOrEqual(0);
      expect(m.errorRecurrenceRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is valid value', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 4));
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('resilience correct for score bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 5));
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      const expected =
        m.recoveryScore >= 75 ? 'resilient' :
        m.recoveryScore >= 55 ? 'capable' :
        m.recoveryScore >= 40 ? 'fragile' : 'critical';
      expect(m.resilience).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by recoveryScore', async () => {
    const sessions = [
      ...makeSessions('agent-j', 5),
      ...makeSessions('agent-k', 4),
      ...makeSessions('agent-l', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentErrorRecoverySpeed();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].recoveryScore).toBeGreaterThanOrEqual(report.metrics[i - 1].recoveryScore);
    }
  });

  it('recoveryScore is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue([...makeSessions('agent-m', 5), ...makeSessions('agent-n', 3)]);
    const report = await analyzeAgentErrorRecoverySpeed();
    for (const m of report.metrics) {
      expect(m.recoveryScore).toBeGreaterThanOrEqual(0);
      expect(m.recoveryScore).toBeLessThanOrEqual(100);
    }
  });

  it('totalErrorsAnalyzed matches session count', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-o', 6));
    const report = await analyzeAgentErrorRecoverySpeed();
    expect(report.metrics[0].totalErrorsAnalyzed).toBe(6);
  });
});
