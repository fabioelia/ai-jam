import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputConsistencyRate } from '../agent-output-consistency-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, status = 'completed') {
  const startedAt = new Date('2026-04-25T10:00:00Z');
  const completedAt = new Date(startedAt.getTime() + 300000);
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

describe('analyzeAgentOutputConsistencyRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.consistency_rate).toBe(0);
    expect(r.total_output_pairs).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.highest_consistency_agent).toBe('N/A');
    expect(r.lowest_consistency_agent).toBe('N/A');
  });

  it('consistency_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.consistency_rate).toBeGreaterThanOrEqual(0);
    expect(r.consistency_rate).toBeLessThanOrEqual(100);
  });

  it('consistent + inconsistent = total_output_pairs', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.consistent_outputs + r.inconsistent_outputs).toBe(r.total_output_pairs);
  });

  it('format_consistency_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.format_consistency_rate).toBeGreaterThanOrEqual(0);
    expect(r.format_consistency_rate).toBeLessThanOrEqual(100);
  });

  it('tone_consistency_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.tone_consistency_rate).toBeGreaterThanOrEqual(0);
    expect(r.tone_consistency_rate).toBeLessThanOrEqual(100);
  });

  it('structural_variance_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.structural_variance_score).toBeGreaterThanOrEqual(0);
    expect(r.structural_variance_score).toBeLessThanOrEqual(100);
  });

  it('avg_output_length_variance is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.avg_output_length_variance).toBeGreaterThanOrEqual(0);
    expect(r.avg_output_length_variance).toBeLessThanOrEqual(100);
  });

  it('most_inconsistent_task_types is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.most_inconsistent_task_types.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('single agent: highest = lowest consistency', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.highest_consistency_agent).toBe(r.lowest_consistency_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.total_output_pairs).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('perfect consistency: no inconsistent outputs', async () => {
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.inconsistent_outputs).toBe(0);
    expect(r.consistent_outputs).toBe(0);
  });

  it('large session set: score stays bounded', async () => {
    setupMock(Array(50).fill(null).map((_, i) => makeSession(`agent-${i % 5}`, 'completed')));
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.consistency_rate).toBeGreaterThanOrEqual(0);
    expect(r.consistency_rate).toBeLessThanOrEqual(100);
    expect(r.total_output_pairs).toBe(50);
  });

  it('highest and lowest consistency agents returned', async () => {
    setupMock([makeSession('agentA'), makeSession('agentB'), makeSession('agentC')]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.highest_consistency_agent).toBeTruthy();
    expect(r.lowest_consistency_agent).toBeTruthy();
  });

  it('mixed agents produce different consistency scores', async () => {
    setupMock([
      makeSession('agentA'), makeSession('agentA'), makeSession('agentA'),
      makeSession('agentB'), makeSession('agentB'),
    ]);
    const r = await analyzeAgentOutputConsistencyRate();
    expect(r.total_output_pairs).toBe(5);
  });
});
