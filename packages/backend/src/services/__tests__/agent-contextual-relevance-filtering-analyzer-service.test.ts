import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentContextualRelevanceFiltering } from '../agent-contextual-relevance-filtering-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, durationMs = 300000, status = 'completed') {
  const startedAt = new Date('2026-04-25T10:00:00Z');
  const completedAt = new Date(startedAt.getTime() + durationMs);
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

describe('analyzeAgentContextualRelevanceFiltering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.relevance_filtering_rate).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.high_relevance_sessions).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('high + low relevance sessions = total_sessions', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 3600000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.high_relevance_sessions + r.low_relevance_sessions).toBe(r.total_sessions);
  });

  it('relevance_filtering_rate = (high / total) * 100', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 60000), makeSession('c', 60000), makeSession('d', 60000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.relevance_filtering_rate).toBeCloseTo((r.high_relevance_sessions / r.total_sessions) * 100, 0);
  });

  it('avg_relevance_score is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.avg_relevance_score).toBeGreaterThanOrEqual(0);
    expect(r.avg_relevance_score).toBeLessThanOrEqual(100);
  });

  it('includes top_distraction_patterns', async () => {
    setupMock([makeSession('a', 300000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.top_distraction_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('returns best and worst filtering agents', async () => {
    setupMock([makeSession('x', 300000), makeSession('y', 300000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.best_filtering_agent).toBeTruthy();
    expect(r.worst_filtering_agent).toBeTruthy();
  });

  it('N/A agents when no sessions', async () => {
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.best_filtering_agent).toBe('N/A');
    expect(r.worst_filtering_agent).toBe('N/A');
  });

  it('handles null timestamps without throwing', async () => {
    setupMock([{ id: 'x', agentId: 'a', status: 'completed', createdAt: null, startedAt: null, completedAt: null }]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r).toBeTruthy();
  });

  it('returns analysis_timestamp as ISO string', async () => {
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.analysis_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles single session', async () => {
    setupMock([makeSession('solo', 120000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.total_sessions).toBe(1);
    expect(r.best_filtering_agent).toBe('solo');
  });

  it('irrelevant_context_ratio is 0–1', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 3600000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.irrelevant_context_ratio).toBeGreaterThanOrEqual(0);
    expect(r.irrelevant_context_ratio).toBeLessThanOrEqual(1);
  });

  it('context_overload_rate is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.context_overload_rate).toBeGreaterThanOrEqual(0);
    expect(r.context_overload_rate).toBeLessThanOrEqual(100);
  });

  it('multiple agents tracked independently', async () => {
    setupMock([
      makeSession('agent-1', 60000),
      makeSession('agent-1', 60000),
      makeSession('agent-2', 3600000),
      makeSession('agent-2', 3600000),
    ]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.best_filtering_agent).not.toBe(r.worst_filtering_agent);
  });

  it('noise_distraction_count >= 0', async () => {
    setupMock([makeSession('a', 3600000)]);
    const r = await analyzeAgentContextualRelevanceFiltering();
    expect(r.noise_distraction_count).toBeGreaterThanOrEqual(0);
  });
});
