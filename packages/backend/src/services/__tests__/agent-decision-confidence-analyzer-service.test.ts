import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentDecisionConfidence } from '../agent-decision-confidence-analyzer-service.js';

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

describe('analyzeAgentDecisionConfidence', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDecisionConfidence();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgConfidenceScore');
    expect(report).toHaveProperty('overconfidentAgents');
    expect(report).toHaveProperty('wellCalibratedAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgConfidenceScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 4));
    const report = await analyzeAgentDecisionConfidence();
    expect(report.fleetAvgConfidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgConfidenceScore).toBeLessThanOrEqual(100);
  });

  it('overconfidentAgents counts agents with calibrationScore < 40', async () => {
    const sessions = [...makeSessions('agent-b', 5), ...makeSessions('agent-c', 5)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentDecisionConfidence();
    const expected = report.metrics.filter(m => m.calibrationScore < 40).length;
    expect(report.overconfidentAgents).toBe(expected);
  });

  it('wellCalibratedAgents counts agents with calibrationScore >= 75', async () => {
    const sessions = [...makeSessions('agent-d', 5), ...makeSessions('agent-e', 5)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentDecisionConfidence();
    const expected = report.metrics.filter(m => m.calibrationScore >= 75).length;
    expect(report.wellCalibratedAgents).toBe(expected);
  });

  it('avgConfidenceScore is in 0-100 per metric', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      expect(m.avgConfidenceScore).toBeGreaterThanOrEqual(0);
      expect(m.avgConfidenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('highConfidenceRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      expect(m.highConfidenceRate).toBeGreaterThanOrEqual(0);
      expect(m.highConfidenceRate).toBeLessThanOrEqual(100);
    }
  });

  it('lowConfidenceRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      expect(m.lowConfidenceRate).toBeGreaterThanOrEqual(0);
      expect(m.lowConfidenceRate).toBeLessThanOrEqual(100);
    }
  });

  it('calibrationScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      expect(m.calibrationScore).toBeGreaterThanOrEqual(0);
      expect(m.calibrationScore).toBeLessThanOrEqual(100);
    }
  });

  it('confidenceTrend is one of rising|stable|declining', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      expect(['rising', 'stable', 'declining']).toContain(m.confidenceTrend);
    }
  });

  it('confidenceLevel correct for bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-k', 4));
    const report = await analyzeAgentDecisionConfidence();
    for (const m of report.metrics) {
      const expected =
        m.calibrationScore >= 75 ? 'well-calibrated' :
        m.avgConfidenceScore >= 75 && m.calibrationScore < 50 ? 'overconfident' :
        m.avgConfidenceScore < 45 ? 'underconfident' : 'erratic';
      expect(m.confidenceLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDecisionConfidence();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by calibrationScore', async () => {
    const sessions = [
      ...makeSessions('agent-l', 5),
      ...makeSessions('agent-m', 4),
      ...makeSessions('agent-n', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentDecisionConfidence();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].calibrationScore).toBeLessThanOrEqual(report.metrics[i - 1].calibrationScore);
    }
  });

  it('empty sessions returns empty metrics array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentDecisionConfidence();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgConfidenceScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('solo-agent', 1));
    const report = await analyzeAgentDecisionConfidence();
    expect(report.metrics).toHaveLength(0);
  });
});
