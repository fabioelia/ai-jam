import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInterruptionHandlingEfficiency } from '../agent-interruption-handling-efficiency-analyzer-service.js';

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

describe('analyzeAgentInterruptionHandlingEfficiency', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns efficiencyScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(typeof report.efficiencyScore).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(report.metrics).toHaveLength(1);
  });

  it('efficiencyScore in 0-100 range per metric', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(m.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.efficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('recoverySuccessRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(m.recoverySuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.recoverySuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('contextRetentionRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(m.contextRetentionRate).toBeGreaterThanOrEqual(0);
      expect(m.contextRetentionRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('metrics sorted descending by efficiencyScore', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].efficiencyScore).toBeLessThanOrEqual(report.metrics[i - 1].efficiencyScore);
    }
  });

  it('mostResilientAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(typeof report.mostResilientAgent).toBe('string');
  });

  it('leastResilientAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(typeof report.leastResilientAgent).toBe('string');
  });

  it('fleet trend is one of valid values', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(['improving', 'stable', 'worsening']).toContain(report.trend);
  });

  it('avgRecoveryTimeMs is non-negative', async () => {
    setupMock([]);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(report.avgRecoveryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    expect(report.metrics).toHaveLength(3);
  });

  it('interruptedSessions <= totalSessions per metric', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(m.interruptedSessions).toBeLessThanOrEqual(m.totalSessions);
    }
  });

  it('successfulRecoveries + failedRecoveries == interruptedSessions', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentInterruptionHandlingEfficiency();
    for (const m of report.metrics) {
      expect(m.successfulRecoveries + m.failedRecoveries).toBe(m.interruptedSessions);
    }
  });
});
