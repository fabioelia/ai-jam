import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentContextSwitchingCostAnalyzer } from '../agent-context-switching-cost-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date) {
  return {
    id: Math.random().toString(),
    agentId,
    status: 'completed',
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

describe('analyzeAgentContextSwitchingCostAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgSwitchingCostScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(typeof report.fleetAvgSwitchingCostScore).toBe('number');
  });

  it('returns highCostAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(typeof report.highCostAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('fleetAvgSwitchingCostScore in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession(`agent-${String.fromCharCode(65 + Math.floor(i / 2))}`, new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    expect(report.fleetAvgSwitchingCostScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgSwitchingCostScore).toBeLessThanOrEqual(100);
  });

  it('metrics sorted ascending by switchingCostScore', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].switchingCostScore).toBeGreaterThanOrEqual(report.metrics[i - 1].switchingCostScore);
    }
  });

  it('switchingTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.switchingTrend);
    }
  });

  it('rating correct for score bands', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
      if (m.switchingCostScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.switchingCostScore >= 65) expect(m.rating).toBe('good');
      else if (m.switchingCostScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('reorientationLatency is positive number', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (const m of report.metrics) {
      expect(m.reorientationLatency).toBeGreaterThan(0);
    }
  });

  it('postSwitchErrorRate in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (const m of report.metrics) {
      expect(m.postSwitchErrorRate).toBeGreaterThanOrEqual(0);
      expect(m.postSwitchErrorRate).toBeLessThanOrEqual(100);
    }
  });

  it('recoveryEfficiency in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    for (const m of report.metrics) {
      expect(m.recoveryEfficiency).toBeGreaterThanOrEqual(0);
      expect(m.recoveryEfficiency).toBeLessThanOrEqual(100);
    }
  });

  it('highCostAgents counts agents with switchingCostScore < 50', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentContextSwitchingCostAnalyzer();
    const expected = report.metrics.filter(m => m.switchingCostScore < 50).length;
    expect(report.highCostAgents).toBe(expected);
  });
});
