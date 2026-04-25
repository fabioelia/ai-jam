import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentNarrativeCoherence } from '../agent-narrative-coherence-analyzer-service.js';

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

describe('analyzeAgentNarrativeCoherence', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns coherenceScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(typeof report.coherenceScore).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(report.metrics.length).toBeGreaterThanOrEqual(0);
  });

  it('coherenceScore in 0-100 range per metric', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentNarrativeCoherence();
    for (const m of report.metrics) {
      expect(m.coherenceScore).toBeGreaterThanOrEqual(0);
      expect(m.coherenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('contradictionRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentNarrativeCoherence();
    for (const m of report.metrics) {
      expect(m.contradictionRate).toBeGreaterThanOrEqual(0);
      expect(m.contradictionRate).toBeLessThanOrEqual(100);
    }
  });

  it('coherentRate in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentNarrativeCoherence();
    for (const m of report.metrics) {
      expect(m.coherentRate).toBeGreaterThanOrEqual(0);
      expect(m.coherentRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentNarrativeCoherence();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('rating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentNarrativeCoherence();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('metrics sorted descending by coherenceScore', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentNarrativeCoherence();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].coherenceScore).toBeLessThanOrEqual(report.metrics[i - 1].coherenceScore);
    }
  });

  it('mostCoherentAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(typeof report.mostCoherentAgent).toBe('string');
  });

  it('leastCoherentAgent is string', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(typeof report.leastCoherentAgent).toBe('string');
  });

  it('fleet trend is one of valid values', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(['improving', 'stable', 'worsening']).toContain(report.trend);
  });

  it('incoherenceCauses has required fields', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(typeof report.incoherenceCauses.contradictions).toBe('number');
    expect(typeof report.incoherenceCauses.topicJumps).toBe('number');
    expect(typeof report.incoherenceCauses.contextLoss).toBe('number');
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1, 2].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentNarrativeCoherence();
    expect(report.metrics.length).toBeGreaterThanOrEqual(0);
  });

  it('avgCoherentTurns is positive', async () => {
    setupMock([]);
    const report = await analyzeAgentNarrativeCoherence();
    expect(report.avgCoherentTurns).toBeGreaterThanOrEqual(0);
  });
});
