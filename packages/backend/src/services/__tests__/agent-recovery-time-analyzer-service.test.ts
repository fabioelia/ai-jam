import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentRecoveryTimeAnalyzer } from '../agent-recovery-time-analyzer-service.js';

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

describe('analyzeAgentRecoveryTimeAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns avgRecoveryTimeSeconds as number', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(typeof report.avgRecoveryTimeSeconds).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for zero sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('recoveryRate in 0-100 range per metric', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(m.recoveryRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgRecoveryTimeSeconds positive', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgRecoveryTimeSeconds).toBeGreaterThan(0);
    }
  });

  it('maxRecoveryTimeSeconds >= avgRecoveryTimeSeconds', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.maxRecoveryTimeSeconds).toBeGreaterThanOrEqual(m.avgRecoveryTimeSeconds);
    }
  });

  it('recoveredCount + failedRecoveryCount = totalFailureEvents', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.recoveredCount + m.failedRecoveryCount).toBe(m.totalFailureEvents);
    }
  });

  it('recoveryTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.recoveryTrend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('metrics sorted ascending by avgRecoveryTimeSeconds', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].avgRecoveryTimeSeconds).toBeGreaterThanOrEqual(report.metrics[i - 1].avgRecoveryTimeSeconds);
    }
  });

  it('fastestRecoveryAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(typeof report.fastestRecoveryAgent).toBe('string');
  });

  it('slowestRecoveryAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(typeof report.slowestRecoveryAgent).toBe('string');
  });

  it('trend is one of valid values', async () => {
    setupMock([]);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(['improving', 'stable', 'worsening']).toContain(report.trend);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentRecoveryTimeAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
