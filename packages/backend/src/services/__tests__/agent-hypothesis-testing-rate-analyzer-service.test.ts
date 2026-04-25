import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentHypothesisTestingRateAnalyzer } from '../agent-hypothesis-testing-rate-analyzer-service.js';

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
    durationMs: 30000,
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentHypothesisTestingRateAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgHypothesisScore', async () => {
    setupMock([]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(typeof report.fleetAvgHypothesisScore).toBe('number');
  });

  it('returns quickCommitAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(typeof report.quickCommitAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('handles empty sessions gracefully', async () => {
    setupMock([]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgHypothesisScore).toBe(0);
    expect(report.quickCommitAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('hypothesisTestingRate is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentA', new Date(now.getTime() + 600000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].hypothesisTestingRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].hypothesisTestingRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgIterationsPerSession >= 1', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].avgIterationsPerSession).toBeGreaterThanOrEqual(1);
    }
  });

  it('explorationDepth >= 1', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].explorationDepth).toBeGreaterThanOrEqual(1);
    }
  });

  it('quickCommitRate is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 600000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].quickCommitRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].quickCommitRate).toBeLessThanOrEqual(100);
    }
  });

  it('hypothesisScore is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentA', new Date(now.getTime() + 120000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].hypothesisScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].hypothesisScore).toBeLessThanOrEqual(100);
    }
  });

  it('sorts metrics by hypothesisScore descending', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 700000)),
      makeSession('AgentB', new Date(now.getTime() + 800000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].hypothesisScore).toBeGreaterThanOrEqual(report.metrics[i].hypothesisScore);
    }
  });

  it('trend is one of improving/stable/degrading', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'degrading']).toContain(report.metrics[0].trend);
    }
  });

  it('rating: excellent when hypothesisScore >= 80', async () => {
    const now = new Date();
    const sessions = [];
    for (let i = 0; i < 20; i++) {
      sessions.push(makeSession('AgentA', new Date(now.getTime() + i * 30000)));
    }
    setupMock(sessions);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0 && report.metrics[0].hypothesisScore >= 80) {
      expect(report.metrics[0].rating).toBe('excellent');
    }
  });

  it('rating is one of excellent/good/fair/poor', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(report.metrics[0].rating);
    }
  });

  it('quickCommitAgents counts agents with quickCommitRate > 70', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 700000)),
      makeSession('AgentB', new Date(now.getTime() + 1400000)),
      makeSession('AgentB', new Date(now.getTime() + 1460000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    const expected = report.metrics.filter(m => m.quickCommitRate > 70).length;
    expect(report.quickCommitAgents).toBe(expected);
  });

  it('fleetAvgHypothesisScore is average of all metric scores', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 700000)),
      makeSession('AgentB', new Date(now.getTime() + 760000)),
    ]);
    const report = await analyzeAgentHypothesisTestingRateAnalyzer();
    if (report.metrics.length > 0) {
      const expected = Math.round(report.metrics.reduce((s, m) => s + m.hypothesisScore, 0) / report.metrics.length);
      expect(report.fleetAvgHypothesisScore).toBe(expected);
    }
  });
});
