import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSemanticOverlapAnalyzer } from '../agent-semantic-overlap-analyzer-service.js';

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
    completedAt: new Date(createdAt.getTime() + 60000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentSemanticOverlapAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns report with all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgNoveltyScore).toBe('number');
    expect(typeof report.highRepetitionAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('includes single-session agents', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now)]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('noveltyScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(m.noveltyScore).toBeGreaterThanOrEqual(0);
      expect(m.noveltyScore).toBeLessThanOrEqual(100);
    }
  });

  it('fleetAvgNoveltyScore is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(report.fleetAvgNoveltyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgNoveltyScore).toBeLessThanOrEqual(100);
  });

  it('metrics sorted descending by noveltyScore', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].noveltyScore).toBeLessThanOrEqual(report.metrics[i - 1].noveltyScore);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('avgOverlapRate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgOverlapRate).toBeGreaterThanOrEqual(0);
      expect(m.avgOverlapRate).toBeLessThanOrEqual(100);
    }
  });

  it('repetitionBursts is non-negative', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(m.repetitionBursts).toBeGreaterThanOrEqual(0);
    }
  });

  it('uniqueTaskTypes is at least 1 when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    for (const m of report.metrics) {
      expect(m.uniqueTaskTypes).toBeGreaterThanOrEqual(1);
    }
  });

  it('highRepetitionAgents counts agents with repetitionBursts > 2', async () => {
    const now = new Date();
    // 6 same-status sessions in a row will create multiple bursts
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-burst', new Date(now.getTime() - i * 1000), 'running')
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    const expected = report.metrics.filter(m => m.repetitionBursts > 2).length;
    expect(report.highRepetitionAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });

  it('all-same-status sessions have 100% overlap rate', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-mono', new Date(now.getTime() - i * 1000), 'running')
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-mono');
    expect(metric).toBeDefined();
    expect(metric!.avgOverlapRate).toBe(100);
  });

  it('all-unique-status sessions have 0% overlap rate', async () => {
    const now = new Date();
    const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    const sessions = statuses.map((status, i) =>
      makeSession('agent-unique', new Date(now.getTime() - i * 1000), status)
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-unique');
    expect(metric).toBeDefined();
    expect(metric!.avgOverlapRate).toBe(0);
  });

  it('rating is excellent when noveltyScore >= 80', async () => {
    const now = new Date();
    // Diverse statuses minimize overlap => high novelty
    const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    const sessions = statuses.map((status, i) =>
      makeSession('agent-excellent', new Date(now.getTime() - i * 1000), status)
    );
    setupMock(sessions);
    const report = await analyzeAgentSemanticOverlapAnalyzer();
    const metric = report.metrics.find(m => m.agentId === 'agent-excellent');
    expect(metric).toBeDefined();
    expect(metric!.rating).toBe('excellent');
  });
});
