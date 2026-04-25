import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentBiasDetectionRate } from '../agent-bias-detection-rate-analyzer-service.js';

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
    status: 'completed',
    retryCount: 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentBiasDetectionRate', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentBiasDetectionRate();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetDetectionRate');
    expect(report).toHaveProperty('highRiskAgents');
    expect(report).toHaveProperty('lowRiskAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentBiasDetectionRate();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetDetectionRate).toBe(0);
    expect(report.highRiskAgents).toBe(0);
    expect(report.lowRiskAgents).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentBiasDetectionRate();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetDetectionRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 5), ...makeSessions('a2', 5)]);
    const report = await analyzeAgentBiasDetectionRate();
    expect(report.fleetDetectionRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetDetectionRate).toBeLessThanOrEqual(100);
  });

  it('biasDetectionRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      expect(m.biasDetectionRate).toBeGreaterThanOrEqual(0);
      expect(m.biasDetectionRate).toBeLessThanOrEqual(100);
    }
  });

  it('falsePositiveRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      expect(m.falsePositiveRate).toBeGreaterThanOrEqual(0);
      expect(m.falsePositiveRate).toBeLessThanOrEqual(100);
    }
  });

  it('missedBiasRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      expect(m.missedBiasRate).toBeGreaterThanOrEqual(0);
      expect(m.missedBiasRate).toBeLessThanOrEqual(100);
    }
  });

  it('topBiasCategory is a non-empty string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      expect(typeof m.topBiasCategory).toBe('string');
      expect(m.topBiasCategory.length).toBeGreaterThan(0);
    }
  });

  it('detectionTrend is valid value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'declining']).toContain(m.detectionTrend);
    }
  });

  it('biasRisk reflects correct bands based on missedBiasRate', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentBiasDetectionRate();
    for (const m of report.metrics) {
      if (m.missedBiasRate >= 50) expect(m.biasRisk).toBe('critical');
      else if (m.missedBiasRate >= 35) expect(m.biasRisk).toBe('high');
      else if (m.missedBiasRate >= 20) expect(m.biasRisk).toBe('moderate');
      else expect(m.biasRisk).toBe('low');
    }
  });

  it('highRiskAgents counts high or critical biasRisk', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentBiasDetectionRate();
    const expected = report.metrics.filter(m => m.biasRisk === 'high' || m.biasRisk === 'critical').length;
    expect(report.highRiskAgents).toBe(expected);
  });

  it('lowRiskAgents counts low biasRisk', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentBiasDetectionRate();
    const expected = report.metrics.filter(m => m.biasRisk === 'low').length;
    expect(report.lowRiskAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentBiasDetectionRate();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by biasDetectionRate', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentBiasDetectionRate();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].biasDetectionRate).toBeGreaterThanOrEqual(report.metrics[i].biasDetectionRate);
    }
  });

  it('multiple agents get separate metrics', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentBiasDetectionRate();
    expect(report.metrics).toHaveLength(2);
  });
});
