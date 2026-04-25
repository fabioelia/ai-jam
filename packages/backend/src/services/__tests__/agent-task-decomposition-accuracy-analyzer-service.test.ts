import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskDecompositionAccuracyAnalyzer } from '../agent-task-decomposition-accuracy-analyzer-service.js';

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

describe('analyzeAgentTaskDecompositionAccuracyAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns report with all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgDecompositionScore).toBe('number');
    expect(typeof report.poorDecomposers).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('includes single-session agents', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now)]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('decompositionScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(m.decompositionScore).toBeGreaterThanOrEqual(0);
      expect(m.decompositionScore).toBeLessThanOrEqual(100);
    }
  });

  it('fleetAvgDecompositionScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(report.fleetAvgDecompositionScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgDecompositionScore).toBeLessThanOrEqual(100);
  });

  it('metrics sorted descending by decompositionScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].decompositionScore).toBeLessThanOrEqual(report.metrics[i - 1].decompositionScore);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('completionRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(m.completionRate).toBeGreaterThanOrEqual(0);
      expect(m.completionRate).toBeLessThanOrEqual(100);
    }
  });

  it('overDecompositionRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(m.overDecompositionRate).toBeGreaterThanOrEqual(0);
      expect(m.overDecompositionRate).toBeLessThanOrEqual(100);
    }
  });

  it('underDecompositionRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(m.underDecompositionRate).toBeGreaterThanOrEqual(0);
      expect(m.underDecompositionRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgSubTasksPerSession is non-negative', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgSubTasksPerSession).toBeGreaterThanOrEqual(0);
    }
  });

  it('poorDecomposers counts agents with decompositionScore < 50', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    const expected = report.metrics.filter(m => m.decompositionScore < 50).length;
    expect(report.poorDecomposers).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });

  it('completionRate is 100 when all sessions are completed', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-complete', new Date(now.getTime() - i * 1000), undefined, 'completed')
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-complete');
    expect(metric).toBeDefined();
    expect(metric!.completionRate).toBe(100);
  });

  it('trend is improving when recent completion rate exceeds older', async () => {
    const now = new Date();
    // 10 recent sessions all completed, 10 older sessions all failed
    const recentSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-trend', new Date(now.getTime() - i * 100), undefined, 'completed')
    );
    const olderSessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('agent-trend', new Date(now.getTime() - (10 + i) * 1000), undefined, 'failed')
    );
    setupMock([...recentSessions, ...olderSessions]);
    const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-trend');
    expect(metric).toBeDefined();
    expect(metric!.trend).toBe('improving');
  });
});
