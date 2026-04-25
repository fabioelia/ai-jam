import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentUncertaintyQuantificationAnalyzer } from '../agent-uncertainty-quantification-analyzer-service.js';

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

describe('analyzeAgentUncertaintyQuantificationAnalyzer', () => {
  it('returns zero score for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.uncertainty_score).toBe(0);
    expect(report.total_sessions).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(typeof report.uncertainty_score).toBe('number');
    expect(typeof report.uncertainty_rate).toBe('number');
    expect(typeof report.appropriate_escalation_rate).toBe('number');
    expect(typeof report.overconfident_rate).toBe('number');
    expect(typeof report.under_expressed_rate).toBe('number');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.most_uncertain_agent).toBe('string');
    expect(typeof report.least_uncertain_agent).toBe('string');
    expect(typeof report.total_sessions).toBe('number');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('uncertainty_score is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed'), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.uncertainty_score).toBeGreaterThanOrEqual(0);
    expect(report.uncertainty_score).toBeLessThanOrEqual(100);
  });

  it('uncertainty_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.uncertainty_rate).toBeGreaterThanOrEqual(0);
    expect(report.uncertainty_rate).toBeLessThanOrEqual(100);
  });

  it('appropriate_escalation_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.appropriate_escalation_rate).toBeGreaterThanOrEqual(0);
    expect(report.appropriate_escalation_rate).toBeLessThanOrEqual(100);
  });

  it('overconfident_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock(Array.from({ length: 5 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000), 'failed')));
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.overconfident_rate).toBeGreaterThanOrEqual(0);
    expect(report.overconfident_rate).toBeLessThanOrEqual(100);
  });

  it('under_expressed_rate is in 0-100 range', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed'), makeSession('agent-a', new Date(now.getTime() - 1000), 'completed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.under_expressed_rate).toBeGreaterThanOrEqual(0);
    expect(report.under_expressed_rate).toBeLessThanOrEqual(100);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_sessions matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.total_sessions).toBe(5);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('most_uncertain_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed'), makeSession('agent-b', new Date(now.getTime() - 1000), 'completed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.most_uncertain_agent).not.toBe('');
  });

  it('least_uncertain_agent is populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed'), makeSession('agent-b', new Date(now.getTime() - 1000), 'completed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.least_uncertain_agent).not.toBe('');
  });

  it('handles all-completed sessions (zero failures)', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-success', new Date(now.getTime() - i * 1000), 'completed')
    );
    setupMock(sessions);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.overconfident_rate).toBe(0);
    expect(report.uncertainty_score).toBeGreaterThanOrEqual(0);
  });

  it('handles all-failed sessions (zero certainty)', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession('agent-fail', new Date(now.getTime() - i * 1000), 'failed')
    );
    setupMock(sessions);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.uncertainty_score).toBeGreaterThanOrEqual(0);
    expect(report.uncertainty_score).toBeLessThanOrEqual(100);
  });

  it('handles single session', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.total_sessions).toBe(1);
    expect(report.uncertainty_score).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple agents', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.total_sessions).toBe(6);
  });

  it('uncertainty_score is non-negative', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed'), makeSession('agent-a', new Date(now.getTime() - 1000), 'failed')]);
    const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
    expect(report.uncertainty_score).toBeGreaterThanOrEqual(0);
  });
});
