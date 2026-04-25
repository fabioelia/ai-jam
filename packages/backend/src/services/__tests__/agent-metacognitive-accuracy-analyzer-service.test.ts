import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentMetacognitiveAccuracyAnalyzer } from '../agent-metacognitive-accuracy-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed', durationMs = 60000) {
  const startedAt = new Date(createdAt.getTime());
  const completedAt = new Date(createdAt.getTime() + durationMs);
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentMetacognitiveAccuracyAnalyzer', () => {
  it('returns zero score for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.accuracy_score).toBe(0);
    expect(report.total_sessions).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(typeof report.accuracy_score).toBe('number');
    expect(typeof report.overconfidence_rate).toBe('number');
    expect(typeof report.underconfidence_rate).toBe('number');
    expect(typeof report.escalation_accuracy_rate).toBe('number');
    expect(typeof report.capability_claim_accuracy_rate).toBe('number');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.most_accurate_agent).toBe('string');
    expect(typeof report.least_accurate_agent).toBe('string');
    expect(typeof report.total_sessions).toBe('number');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('accuracy_score is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.accuracy_score).toBeGreaterThanOrEqual(0);
    expect(report.accuracy_score).toBeLessThanOrEqual(100);
  });

  it('overconfidence_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 60000), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed', 60000)]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.overconfidence_rate).toBeGreaterThanOrEqual(0);
    expect(report.overconfidence_rate).toBeLessThanOrEqual(100);
  });

  it('underconfidence_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 10000)]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.underconfidence_rate).toBeGreaterThanOrEqual(0);
    expect(report.underconfidence_rate).toBeLessThanOrEqual(100);
  });

  it('escalation_accuracy_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed', 10000)]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.escalation_accuracy_rate).toBeGreaterThanOrEqual(0);
    expect(report.escalation_accuracy_rate).toBeLessThanOrEqual(100);
  });

  it('capability_claim_accuracy_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 60000)]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.capability_claim_accuracy_rate).toBeGreaterThanOrEqual(0);
    expect(report.capability_claim_accuracy_rate).toBeLessThanOrEqual(100);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_sessions matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 8 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.total_sessions).toBe(8);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('most_accurate_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.most_accurate_agent).not.toBe('');
  });

  it('least_accurate_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.least_accurate_agent).not.toBe('');
  });

  it('perfect accuracy scenario: all completed non-escalated', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-perfect', new Date(now.getTime() - i * 1000), 'completed', 60000)
    );
    setupMock(sessions);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.accuracy_score).toBeGreaterThan(0);
    expect(report.overconfidence_rate).toBe(0);
  });

  it('all overconfident scenario: all failed non-escalated', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-over', new Date(now.getTime() - i * 1000), 'failed', 60000)
    );
    setupMock(sessions);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.overconfidence_rate).toBeGreaterThan(0);
  });

  it('handles single session', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.total_sessions).toBe(1);
    expect(report.accuracy_score).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple agents correctly', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1, 2].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.total_sessions).toBe(9);
  });

  it('more accurate agent ranks higher', async () => {
    const now = new Date();
    const sessions = [
      ...Array.from({ length: 5 }, (_, i) => makeSession('agent-good', new Date(now.getTime() - i * 1000), 'completed', 60000)),
      ...Array.from({ length: 5 }, (_, i) => makeSession('agent-bad', new Date(now.getTime() - i * 1000), 'failed', 60000)),
    ];
    setupMock(sessions);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.most_accurate_agent).toBe('agent-good');
    expect(report.least_accurate_agent).toBe('agent-bad');
  });

  it('zero sessions scenario returns empty agent names', async () => {
    setupMock([]);
    const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
    expect(report.most_accurate_agent).toBe('');
    expect(report.least_accurate_agent).toBe('');
  });
});
