import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInformationDensityAnalyzer } from '../agent-information-density-analyzer-service.js';

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

describe('analyzeAgentInformationDensityAnalyzer', () => {
  it('returns zero score for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.density_score).toBe(0);
    expect(report.total_sessions).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(typeof report.density_score).toBe('number');
    expect(typeof report.high_density_rate).toBe('number');
    expect(typeof report.low_density_rate).toBe('number');
    expect(typeof report.verbosity_rate).toBe('number');
    expect(typeof report.terseness_rate).toBe('number');
    expect(typeof report.avg_density).toBe('number');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.most_dense_agent).toBe('string');
    expect(typeof report.least_dense_agent).toBe('string');
    expect(typeof report.total_sessions).toBe('number');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('density_score is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.density_score).toBeGreaterThanOrEqual(0);
    expect(report.density_score).toBeLessThanOrEqual(100);
  });

  it('high_density_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 30000)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.high_density_rate).toBeGreaterThanOrEqual(0);
    expect(report.high_density_rate).toBeLessThanOrEqual(100);
  });

  it('low_density_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 600000)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.low_density_rate).toBeGreaterThanOrEqual(0);
    expect(report.low_density_rate).toBeLessThanOrEqual(100);
  });

  it('verbosity_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 300000), makeSession('agent-b', new Date(now.getTime() - 1000), 'completed')]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.verbosity_rate).toBeGreaterThanOrEqual(0);
    expect(report.verbosity_rate).toBeLessThanOrEqual(100);
  });

  it('terseness_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 5000)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.terseness_rate).toBeGreaterThanOrEqual(0);
    expect(report.terseness_rate).toBeLessThanOrEqual(100);
  });

  it('avg_density is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.avg_density).toBeGreaterThanOrEqual(0);
    expect(report.avg_density).toBeLessThanOrEqual(100);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_sessions matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.total_sessions).toBe(7);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('most_dense_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 30000), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed', 600000)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.most_dense_agent).not.toBe('');
  });

  it('least_dense_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 30000), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed', 600000)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.least_dense_agent).not.toBe('');
  });

  it('high density agent has higher avg_density than low density agent', async () => {
    const now = new Date();
    // agent-dense: short + successful
    // agent-verbose: long + failed
    const sessions = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('agent-dense', new Date(now.getTime() - i * 1000), 'completed', 10000)),
      ...Array.from({ length: 3 }, (_, i) => makeSession('agent-verbose', new Date(now.getTime() - i * 1000), 'failed', 600000)),
    ];
    setupMock(sessions);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.most_dense_agent).toBe('agent-dense');
    expect(report.least_dense_agent).toBe('agent-verbose');
  });

  it('handles single session', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.total_sessions).toBe(1);
    expect(report.density_score).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple agents', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.total_sessions).toBe(6);
  });

  it('density_score is non-negative for all-failed sessions', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-fail', new Date(now.getTime() - i * 1000), 'failed', 600000)
    );
    setupMock(sessions);
    const report = await analyzeAgentInformationDensityAnalyzer();
    expect(report.density_score).toBeGreaterThanOrEqual(0);
  });
});
