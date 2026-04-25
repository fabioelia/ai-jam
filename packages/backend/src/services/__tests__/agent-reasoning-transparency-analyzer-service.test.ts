import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentReasoningTransparencyAnalyzer } from '../agent-reasoning-transparency-analyzer-service.js';

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

describe('analyzeAgentReasoningTransparencyAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('fleetAvgTransparencyScore in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(report.fleetAvgTransparencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgTransparencyScore).toBeLessThanOrEqual(100);
  });

  it('reasoningExposureRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.reasoningExposureRate).toBeGreaterThanOrEqual(0);
      expect(m.reasoningExposureRate).toBeLessThanOrEqual(100);
    }
  });

  it('explainabilityIndex in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.explainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(m.explainabilityIndex).toBeLessThanOrEqual(100);
    }
  });

  it('auditabilityRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.auditabilityRate).toBeGreaterThanOrEqual(0);
      expect(m.auditabilityRate).toBeLessThanOrEqual(100);
    }
  });

  it('reasoningDepthScore is positive number', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.reasoningDepthScore).toBeGreaterThan(0);
    }
  });

  it('transparencyTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.transparencyTrend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by transparencyScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].transparencyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].transparencyScore);
    }
  });

  it('lowTransparencyAgents counts reasoningExposureRate < 40', async () => {
    setupMock([]);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    const expected = report.metrics.filter(m => m.reasoningExposureRate < 40).length;
    expect(report.lowTransparencyAgents).toBe(expected);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentReasoningTransparencyAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
