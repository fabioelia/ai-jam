import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputAccuracyRateAnalyzer } from '../agent-output-accuracy-rate-analyzer-service.js';

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

describe('analyzeAgentOutputAccuracyRateAnalyzer', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgOutputAccuracyRate');
    expect(report).toHaveProperty('lowAccuracyAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgOutputAccuracyRate is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(report.fleetAvgOutputAccuracyRate).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgOutputAccuracyRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(report.fleetAvgOutputAccuracyRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgOutputAccuracyRate).toBeLessThanOrEqual(100);
  });

  it('outputAccuracyRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.outputAccuracyRate).toBeGreaterThanOrEqual(0);
      expect(m.outputAccuracyRate).toBeLessThanOrEqual(100);
    }
  });

  it('accurateOutputs + inaccurateOutputs === totalOutputs', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.accurateOutputs + m.inaccurateOutputs).toBe(m.totalOutputs);
    }
  });

  it('hallucinationRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.hallucinationRate).toBeGreaterThanOrEqual(0);
      expect(m.hallucinationRate).toBeLessThanOrEqual(100);
    }
  });

  it('reworkRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.reworkRate).toBeGreaterThanOrEqual(0);
      expect(m.reworkRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    const valid = ['improving', 'stable', 'degrading'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (const m of report.metrics) {
      if (m.outputAccuracyRate >= 85) expect(m.rating).toBe('excellent');
      else if (m.outputAccuracyRate >= 70) expect(m.rating).toBe('good');
      else if (m.outputAccuracyRate >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by outputAccuracyRate', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].outputAccuracyRate).toBeGreaterThanOrEqual(report.metrics[i - 1].outputAccuracyRate);
    }
  });

  it('lowAccuracyAgents counts agents with rate < 50', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentOutputAccuracyRateAnalyzer();
    const expected = report.metrics.filter(m => m.outputAccuracyRate < 50).length;
    expect(report.lowAccuracyAgents).toBe(expected);
  });
});
