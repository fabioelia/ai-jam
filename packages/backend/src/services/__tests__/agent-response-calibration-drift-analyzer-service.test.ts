import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentResponseCalibrationDriftAnalyzer } from '../agent-response-calibration-drift-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed', durationMs = 60000) {
  const startedAt = new Date(createdAt.getTime());
  const completedAt = new Date(createdAt.getTime() + durationMs);
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentResponseCalibrationDriftAnalyzer', () => {
  it('returns zero score for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.drift_score).toBe(0);
    expect(report.total_sessions).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(typeof report.drift_score).toBe('number');
    expect(typeof report.high_drift_rate).toBe('number');
    expect(typeof report.stable_rate).toBe('number');
    expect(typeof report.avg_drift).toBe('number');
    expect(typeof report.early_late_quality_delta).toBe('number');
    expect(typeof report.drift_acceleration_rate).toBe('number');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.most_stable_agent).toBe('string');
    expect(typeof report.most_drifting_agent).toBe('string');
    expect(typeof report.total_sessions).toBe('number');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('drift_score is in 0-100 range', async () => {
    const now = new Date();
    setupMock([
      makeSession('agent-a', now, 'completed', 30000),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'failed', 600000),
      makeSession('agent-a', new Date(now.getTime() - 2000), 'completed', 30000),
    ]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.drift_score).toBeGreaterThanOrEqual(0);
    expect(report.drift_score).toBeLessThanOrEqual(100);
  });

  it('high_drift_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 600000), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.high_drift_rate).toBeGreaterThanOrEqual(0);
    expect(report.high_drift_rate).toBeLessThanOrEqual(100);
  });

  it('stable_rate is in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-stable', new Date(now.getTime() - i * 1000), 'completed', 30000)
    );
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.stable_rate).toBeGreaterThanOrEqual(0);
    expect(report.stable_rate).toBeLessThanOrEqual(100);
  });

  it('avg_drift is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.avg_drift).toBeGreaterThanOrEqual(0);
    expect(report.avg_drift).toBeLessThanOrEqual(100);
  });

  it('early_late_quality_delta is non-negative', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), i < 3 ? 'completed' : 'failed')
    );
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.early_late_quality_delta).toBeGreaterThanOrEqual(0);
  });

  it('drift_acceleration_rate is non-negative', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), i % 2 === 0 ? 'completed' : 'failed')
    );
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.drift_acceleration_rate).toBeGreaterThanOrEqual(0);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_sessions matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 9 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.total_sessions).toBe(9);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('most_stable_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([
      makeSession('stable-agent', now, 'completed', 30000),
      makeSession('drift-agent', new Date(now.getTime() - 1000), 'failed', 600000),
    ]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.most_stable_agent).not.toBe('');
  });

  it('most_drifting_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([
      makeSession('stable-agent', now, 'completed', 30000),
      makeSession('drift-agent', new Date(now.getTime() - 1000), 'failed', 600000),
    ]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.most_drifting_agent).not.toBe('');
  });

  it('zero drift scenario: all stable completions', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-stable', new Date(now.getTime() - i * 1000), 'completed', 30000)
    );
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.drift_score).toBeLessThanOrEqual(30);
  });

  it('handles single session', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.total_sessions).toBe(1);
    expect(report.drift_score).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple agents', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1, 2].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.total_sessions).toBe(9);
  });

  it('stable agent ranks better than drifting agent', async () => {
    const now = new Date();
    const sessions = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeSession('stable-one', new Date(now.getTime() - i * 1000), 'completed', 30000)
      ),
      makeSession('drifting-one', new Date(now.getTime() - 100), 'completed', 30000),
      makeSession('drifting-one', new Date(now.getTime() - 200), 'failed', 600000),
      makeSession('drifting-one', new Date(now.getTime() - 300), 'completed', 30000),
      makeSession('drifting-one', new Date(now.getTime() - 400), 'failed', 600000),
    ];
    setupMock(sessions);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.most_stable_agent).toBe('stable-one');
  });

  it('empty returns empty agent names', async () => {
    setupMock([]);
    const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
    expect(report.most_stable_agent).toBe('');
    expect(report.most_drifting_agent).toBe('');
  });
});
