import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentKnowledgeTransferEfficiency } from '../agent-knowledge-transfer-efficiency-analyzer-service.js';

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

describe('analyzeAgentKnowledgeTransferEfficiency', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgTransferScore');
    expect(report).toHaveProperty('highLossAgents');
    expect(report).toHaveProperty('excellentTransferAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgTransferScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    expect(report.fleetAvgTransferScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgTransferScore).toBeLessThanOrEqual(100);
  });

  it('highLossAgents counts agents with knowledgeLossEvents > 3', async () => {
    const sessions = [...makeSessions('agent-b', 5), ...makeSessions('agent-c', 5)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    const expected = report.metrics.filter(m => m.knowledgeLossEvents > 3).length;
    expect(report.highLossAgents).toBe(expected);
  });

  it('excellentTransferAgents counts agents with transferEfficiencyScore >= 85', async () => {
    const sessions = [...makeSessions('agent-d', 5), ...makeSessions('agent-e', 5)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    const expected = report.metrics.filter(m => m.transferEfficiencyScore >= 85).length;
    expect(report.excellentTransferAgents).toBe(expected);
  });

  it('transferEfficiencyScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (const m of report.metrics) {
      expect(m.transferEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.transferEfficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('avgContextRetentionRate is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (const m of report.metrics) {
      expect(m.avgContextRetentionRate).toBeGreaterThanOrEqual(0);
      expect(m.avgContextRetentionRate).toBeLessThanOrEqual(100);
    }
  });

  it('transferLatency is >= 0', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (const m of report.metrics) {
      expect(m.transferLatency).toBeGreaterThanOrEqual(0);
    }
  });

  it('transferTrend is one of improving|stable|degrading', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.transferTrend);
    }
  });

  it('transferQuality correct for bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 4));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (const m of report.metrics) {
      const expected =
        m.transferEfficiencyScore >= 85 ? 'excellent' :
        m.transferEfficiencyScore >= 65 ? 'good' :
        m.transferEfficiencyScore >= 40 ? 'poor' : 'failing';
      expect(m.transferQuality).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by transferEfficiencyScore', async () => {
    const sessions = [
      ...makeSessions('agent-k', 5),
      ...makeSessions('agent-l', 4),
      ...makeSessions('agent-m', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].transferEfficiencyScore).toBeLessThanOrEqual(report.metrics[i - 1].transferEfficiencyScore);
    }
  });

  it('empty sessions returns empty metrics array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgTransferScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('solo-agent', 1));
    const report = await analyzeAgentKnowledgeTransferEfficiency();
    expect(report.metrics).toHaveLength(0);
  });
});
