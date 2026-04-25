import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputDiversityAnalyzer } from '../agent-output-diversity-analyzer-service.js';

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

describe('analyzeAgentOutputDiversityAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns report with all required fields', async () => {
    setupMock([]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgDiversityScore).toBe('number');
    expect(typeof report.lowDiversityAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('diversityScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (const m of report.metrics) {
      expect(m.diversityScore).toBeGreaterThanOrEqual(0);
      expect(m.diversityScore).toBeLessThanOrEqual(100);
    }
  });

  it('metrics sorted descending by diversityScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].diversityScore).toBeLessThanOrEqual(report.metrics[i - 1].diversityScore);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('repetitionRate is in 0-100 range', async () => {
    const now = new Date();
    const sessions = [
      makeSession('agent-a', now, 'completed'),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'failed'),
      makeSession('agent-a', new Date(now.getTime() - 2000), 'completed'),
    ];
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (const m of report.metrics) {
      expect(m.repetitionRate).toBeGreaterThanOrEqual(0);
      expect(m.repetitionRate).toBeLessThanOrEqual(100);
    }
  });

  it('adaptabilityScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    for (const m of report.metrics) {
      expect(m.adaptabilityScore).toBeGreaterThanOrEqual(0);
      expect(m.adaptabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('statusDistribution is an object with status keys', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed'), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    const m = report.metrics[0];
    expect(typeof m.statusDistribution).toBe('object');
    expect(m.statusDistribution).not.toBeNull();
  });

  it('lowDiversityAgents counts agents with diversityScore < 40', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    const expected = report.metrics.filter(m => m.diversityScore < 40).length;
    expect(report.lowDiversityAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('uniqueStatusCount reflects distinct statuses', async () => {
    const now = new Date();
    const sessions = [
      makeSession('agent-a', now, 'completed'),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'failed'),
      makeSession('agent-a', new Date(now.getTime() - 2000), 'running'),
    ];
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics[0].uniqueStatusCount).toBe(3);
  });

  it('high repetition rate when all statuses are identical', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'completed')
    );
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics[0].repetitionRate).toBe(100);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentOutputDiversityAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });
});
