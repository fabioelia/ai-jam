import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskAbandonmentRateAnalyzer } from '../agent-task-abandonment-rate-analyzer-service.js';

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

describe('analyzeAgentTaskAbandonmentRateAnalyzer', () => {
  it('returns zero rates for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.abandonment_rate).toBe(0);
    expect(report.total_tasks).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(typeof report.abandonment_rate).toBe('number');
    expect(typeof report.escalation_rate).toBe('number');
    expect(typeof report.total_tasks).toBe('number');
    expect(typeof report.abandoned_tasks).toBe('number');
    expect(typeof report.graceful_escalations).toBe('number');
    expect(typeof report.silent_abandonments).toBe('number');
    expect(Array.isArray(report.top_abandonment_reasons)).toBe(true);
    expect(typeof report.avg_completion_depth_before_abandon).toBe('number');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.highest_abandonment_agent).toBe('string');
    expect(typeof report.lowest_abandonment_agent).toBe('string');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('abandonment_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 60000)]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.abandonment_rate).toBeGreaterThanOrEqual(0);
    expect(report.abandonment_rate).toBeLessThanOrEqual(100);
  });

  it('zero abandonments scenario', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'completed', 60000)
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.abandonment_rate).toBe(0);
    expect(report.silent_abandonments).toBe(0);
  });

  it('all abandoned scenario', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'failed', 60000)
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.abandonment_rate).toBe(100);
    expect(report.silent_abandonments).toBe(5);
  });

  it('escalation-only scenario: short failed sessions are graceful escalations', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'failed', 10000)
    );
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.graceful_escalations).toBe(4);
    expect(report.silent_abandonments).toBe(0);
    expect(report.abandonment_rate).toBe(0);
  });

  it('mixed scenario: both escalations and abandonments', async () => {
    const now = new Date();
    const sessions = [
      makeSession('agent-a', now, 'failed', 60000),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'failed', 10000),
      makeSession('agent-a', new Date(now.getTime() - 2000), 'completed', 60000),
    ];
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.silent_abandonments).toBe(1);
    expect(report.graceful_escalations).toBe(1);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_tasks matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.total_tasks).toBe(7);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('highest_abandonment_agent populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 60000), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.highest_abandonment_agent).not.toBe('');
  });

  it('lowest_abandonment_agent populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 60000), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.lowest_abandonment_agent).not.toBe('');
  });

  it('empty sessions returns empty agent names', async () => {
    setupMock([]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.highest_abandonment_agent).toBe('');
    expect(report.lowest_abandonment_agent).toBe('');
  });

  it('highest abandonment agent ranked correctly', async () => {
    const now = new Date();
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => makeSession('agent-bad', new Date(now.getTime() - i * 1000), 'failed', 60000)),
      ...Array.from({ length: 4 }, (_, i) => makeSession('agent-good', new Date(now.getTime() - i * 1000), 'completed', 60000)),
    ];
    setupMock(sessions);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.highest_abandonment_agent).toBe('agent-bad');
    expect(report.lowest_abandonment_agent).toBe('agent-good');
  });

  it('avg_completion_depth_before_abandon is in 0-1 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 60000)]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.avg_completion_depth_before_abandon).toBeGreaterThanOrEqual(0);
    expect(report.avg_completion_depth_before_abandon).toBeLessThanOrEqual(1);
  });

  it('handles single session without error', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
    expect(report.total_tasks).toBe(1);
    expect(report.abandonment_rate).toBeGreaterThanOrEqual(0);
  });
});
