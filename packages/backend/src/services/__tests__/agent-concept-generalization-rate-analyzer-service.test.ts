import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentConceptGeneralizationRateAnalyzer } from '../agent-concept-generalization-rate-analyzer-service.js';

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

describe('analyzeAgentConceptGeneralizationRateAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('fleetAvgGeneralizationScore in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(report.fleetAvgGeneralizationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgGeneralizationScore).toBeLessThanOrEqual(100);
  });

  it('crossDomainSuccessRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.crossDomainSuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.crossDomainSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('knowledgeTransferRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.knowledgeTransferRate).toBeGreaterThanOrEqual(0);
      expect(m.knowledgeTransferRate).toBeLessThanOrEqual(100);
    }
  });

  it('domainAdaptationSpeed is positive number', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.domainAdaptationSpeed).toBeGreaterThan(0);
    }
  });

  it('novelTaskHandlingRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.novelTaskHandlingRate).toBeGreaterThanOrEqual(0);
      expect(m.novelTaskHandlingRate).toBeLessThanOrEqual(100);
    }
  });

  it('generalizationTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.generalizationTrend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by generalizationScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].generalizationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].generalizationScore);
    }
  });

  it('lowGeneralizationAgents counts crossDomainSuccessRate < 50', async () => {
    setupMock([]);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    const expected = report.metrics.filter(m => m.crossDomainSuccessRate < 50).length;
    expect(report.lowGeneralizationAgents).toBe(expected);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
