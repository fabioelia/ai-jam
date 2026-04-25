import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAdaptiveLearningRateAnalyzer } from '../agent-adaptive-learning-rate-analyzer-service.js';

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

describe('analyzeAgentAdaptiveLearningRateAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgAdaptiveLearningScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(typeof report.fleetAvgAdaptiveLearningScore).toBe('number');
  });

  it('returns slowLearnerAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(typeof report.slowLearnerAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('handles empty sessions gracefully', async () => {
    setupMock([]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAdaptiveLearningScore).toBe(0);
    expect(report.slowLearnerAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('adaptiveLearningScore is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].adaptiveLearningScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].adaptiveLearningScore).toBeLessThanOrEqual(100);
    }
  });

  it('feedbackIncorporationRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].feedbackIncorporationRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].feedbackIncorporationRate).toBeLessThanOrEqual(100);
    }
  });

  it('errorCorrectionSpeed is positive number', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].errorCorrectionSpeed).toBeGreaterThan(0);
    }
  });

  it('patternGeneralizationRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].patternGeneralizationRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].patternGeneralizationRate).toBeLessThanOrEqual(100);
    }
  });

  it('behaviorConsistencyRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].behaviorConsistencyRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].behaviorConsistencyRate).toBeLessThanOrEqual(100);
    }
  });

  it('learningTrend is one of improving/stable/worsening', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'worsening']).toContain(report.metrics[0].learningTrend);
    }
  });

  it('rating is one of excellent/good/fair/poor', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(report.metrics[0].rating);
    }
  });

  it('metrics sorted ascending by adaptiveLearningScore', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].adaptiveLearningScore).toBeLessThanOrEqual(report.metrics[i].adaptiveLearningScore);
    }
  });

  it('slowLearnerAgents counts agents with adaptiveLearningScore < 55', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    const expected = report.metrics.filter(m => m.adaptiveLearningScore < 55).length;
    expect(report.slowLearnerAgents).toBe(expected);
  });

  it('fleetAvgAdaptiveLearningScore is average of metric scores', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
    if (report.metrics.length > 0) {
      const expected = Math.round(report.metrics.reduce((s, m) => s + m.adaptiveLearningScore, 0) / report.metrics.length);
      expect(report.fleetAvgAdaptiveLearningScore).toBe(expected);
    }
  });
});
