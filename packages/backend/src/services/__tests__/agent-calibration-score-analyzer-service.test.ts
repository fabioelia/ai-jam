import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCalibrationScoreAnalyzer } from '../agent-calibration-score-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed') {
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + 30000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentCalibrationScoreAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns calibrationScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(typeof report.calibrationScore).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('calibrationScore in 0-100 range for each metric', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.calibrationScore).toBeGreaterThanOrEqual(0);
      expect(m.calibrationScore).toBeLessThanOrEqual(100);
    }
  });

  it('accuracyRate in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.accuracyRate).toBeGreaterThanOrEqual(0);
      expect(m.accuracyRate).toBeLessThanOrEqual(100);
    }
  });

  it('confidenceRate in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.confidenceRate).toBeGreaterThanOrEqual(0);
      expect(m.confidenceRate).toBeLessThanOrEqual(100);
    }
  });

  it('calibrationTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.calibrationTrend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('metrics sorted descending by calibrationScore', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].calibrationScore).toBeLessThanOrEqual(report.metrics[i - 1].calibrationScore);
    }
  });

  it('bestCalibratedAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(typeof report.bestCalibratedAgent).toBe('string');
  });

  it('worstCalibratedAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(typeof report.worstCalibratedAgent).toBe('string');
  });

  it('trend is one of valid values', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(['improving', 'stable', 'worsening']).toContain(report.trend);
  });

  it('fleet wellCalibratedRate is number', async () => {
    setupMock([]);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(typeof report.wellCalibratedRate).toBe('number');
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentCalibrationScoreAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
