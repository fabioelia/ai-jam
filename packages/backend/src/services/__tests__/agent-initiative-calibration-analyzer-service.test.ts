import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInitiativeCalibrationAnalyzer } from '../agent-initiative-calibration-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, completedAt?: Date, status = 'completed') {
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: completedAt ? completedAt.toISOString() : new Date(createdAt.getTime() + 60000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentInitiativeCalibrationAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns report with all required fields', async () => {
    setupMock([]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgCalibrationScore).toBe('number');
    expect(typeof report.poorlyCalibrated).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('calibrationScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.calibrationScore).toBeGreaterThanOrEqual(0);
      expect(m.calibrationScore).toBeLessThanOrEqual(100);
    }
  });

  it('fleetAvgCalibrationScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(report.fleetAvgCalibrationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCalibrationScore).toBeLessThanOrEqual(100);
  });

  it('metrics sorted descending by calibrationScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].calibrationScore).toBeLessThanOrEqual(report.metrics[i - 1].calibrationScore);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('overReachRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.overReachRate).toBeGreaterThanOrEqual(0);
      expect(m.overReachRate).toBeLessThanOrEqual(100);
    }
  });

  it('underReachRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.underReachRate).toBeGreaterThanOrEqual(0);
      expect(m.underReachRate).toBeLessThanOrEqual(100);
    }
  });

  it('poorlyCalibrated counts agents with calibrationScore < 50', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    const expected = report.metrics.filter(m => m.calibrationScore < 50).length;
    expect(report.poorlyCalibrated).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('trend is improving when recent variance is much lower than older', async () => {
    const now = new Date();
    // Older sessions (11-20) vary widely; recent sessions (1-10) are very consistent
    const consistent = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-x', new Date(now.getTime() - i * 100), new Date(now.getTime() - i * 100 + 30000))
    );
    const varied = Array.from({ length: 10 }, (_, i) => {
      const duration = (i % 2 === 0) ? 5000 : 500000; // huge variance
      return makeSession('agent-x', new Date(now.getTime() - (10 + i) * 1000), new Date(now.getTime() - (10 + i) * 1000 + duration));
    });
    setupMock([...consistent, ...varied]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-x');
    expect(metric).toBeDefined();
    expect(metric!.trend).toBe('improving');
  });

  it('avgSessionDuration is non-negative', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgSessionDuration).toBeGreaterThanOrEqual(0);
    }
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInitiativeCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
