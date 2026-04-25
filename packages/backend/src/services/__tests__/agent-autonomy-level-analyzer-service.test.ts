import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAutonomyLevel } from '../agent-autonomy-level-analyzer-service.js';

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

describe('analyzeAgentAutonomyLevel', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentAutonomyLevel();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgAutonomyScore');
    expect(report).toHaveProperty('dependentAgents');
    expect(report).toHaveProperty('fullyAutonomousAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgAutonomyScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 4));
    const report = await analyzeAgentAutonomyLevel();
    expect(report.fleetAvgAutonomyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgAutonomyScore).toBeLessThanOrEqual(100);
  });

  it('dependentAgents counts agents with autonomyScore < 40', async () => {
    const sessions = [
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentAutonomyLevel();
    const expected = report.metrics.filter(m => m.autonomyScore < 40).length;
    expect(report.dependentAgents).toBe(expected);
  });

  it('fullyAutonomousAgents counts agents with autonomyScore >= 80', async () => {
    const sessions = [
      ...makeSessions('agent-d', 5),
      ...makeSessions('agent-e', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentAutonomyLevel();
    const expected = report.metrics.filter(m => m.autonomyScore >= 80).length;
    expect(report.fullyAutonomousAgents).toBe(expected);
  });

  it('unsupervisedCompletionRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 3));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(m.unsupervisedCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.unsupervisedCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('humanOverrideRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(m.humanOverrideRate).toBeGreaterThanOrEqual(0);
      expect(m.humanOverrideRate).toBeLessThanOrEqual(100);
    }
  });

  it('escalationRatio is non-negative', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 3));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(m.escalationRatio).toBeGreaterThanOrEqual(0);
    }
  });

  it('selfResolutionRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 3));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(m.selfResolutionRate).toBeGreaterThanOrEqual(0);
      expect(m.selfResolutionRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving|stable|degrading', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 4));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('autonomyLevel is one of fully-autonomous|semi-autonomous|assisted|dependent', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-k', 4));
    const report = await analyzeAgentAutonomyLevel();
    for (const m of report.metrics) {
      expect(['fully-autonomous', 'semi-autonomous', 'assisted', 'dependent']).toContain(m.autonomyLevel);
      const expected =
        m.autonomyScore >= 80 ? 'fully-autonomous' :
        m.autonomyScore >= 60 ? 'semi-autonomous' :
        m.autonomyScore >= 40 ? 'assisted' : 'dependent';
      expect(m.autonomyLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentAutonomyLevel();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by autonomyScore', async () => {
    const sessions = [
      ...makeSessions('agent-l', 5),
      ...makeSessions('agent-m', 4),
      ...makeSessions('agent-n', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentAutonomyLevel();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].autonomyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].autonomyScore);
    }
  });
});
