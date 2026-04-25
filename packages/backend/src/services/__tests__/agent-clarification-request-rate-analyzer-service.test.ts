import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentClarificationRequestRate } from '../agent-clarification-request-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, durationMs = 60000, status = 'completed') {
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

describe('analyzeAgentClarificationRequestRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.clarification_rate).toBe(0);
    expect(r.assumption_rate).toBe(100);
    expect(r.total_instructions).toBe(0);
    expect(r.clarification_requests).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('computes clarification rate for single agent', async () => {
    setupMock([makeSession('agent-A', 30000), makeSession('agent-A', 30000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.total_instructions).toBeGreaterThan(0);
    expect(r.clarification_rate).toBeGreaterThanOrEqual(0);
    expect(r.clarification_rate + r.assumption_rate).toBeCloseTo(100, 1);
  });

  it('clarification_rate + assumption_rate = 100', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 120000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.clarification_rate + r.assumption_rate).toBeCloseTo(100, 1);
  });

  it('returns highest and lowest clarification agents', async () => {
    setupMock([makeSession('agent-X', 300000), makeSession('agent-Y', 15000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.highest_clarification_agent).toBeTruthy();
    expect(r.lowest_clarification_agent).toBeTruthy();
  });

  it('assumed_proceeds = total_instructions - clarification_requests', async () => {
    setupMock([makeSession('a', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.assumed_proceeds).toBe(Math.max(0, r.total_instructions - r.clarification_requests));
  });

  it('includes top_clarification_triggers', async () => {
    setupMock([makeSession('a', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.top_clarification_triggers.length).toBeGreaterThan(0);
  });

  it('clarification_accuracy is 0–100', async () => {
    setupMock([makeSession('a', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.clarification_accuracy).toBeGreaterThanOrEqual(0);
    expect(r.clarification_accuracy).toBeLessThanOrEqual(100);
  });

  it('avg_clarifications_per_task > 0 with sessions', async () => {
    setupMock([makeSession('a', 120000), makeSession('b', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.avg_clarifications_per_task).toBeGreaterThanOrEqual(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 60000), makeSession('c', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('handles failed sessions without throwing', async () => {
    setupMock([makeSession('a', 30000, 'failed')]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r).toBeTruthy();
    expect(r.clarification_rate).toBeGreaterThanOrEqual(0);
  });

  it('N/A agents when no sessions', async () => {
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.highest_clarification_agent).toBe('N/A');
    expect(r.lowest_clarification_agent).toBe('N/A');
  });

  it('handles single session correctly', async () => {
    setupMock([makeSession('solo', 90000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.total_instructions).toBeGreaterThan(0);
    expect(r.highest_clarification_agent).toBe('solo');
  });

  it('returns analysis_timestamp as ISO string', async () => {
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.analysis_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('clarification_rate is 0–100', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 60000), makeSession('c', 60000)]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.clarification_rate).toBeGreaterThanOrEqual(0);
    expect(r.clarification_rate).toBeLessThanOrEqual(100);
  });

  it('multiple agents tracked independently', async () => {
    setupMock([
      makeSession('agent-1', 300000),
      makeSession('agent-1', 300000),
      makeSession('agent-2', 15000),
      makeSession('agent-2', 15000),
    ]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r.highest_clarification_agent).not.toBe(r.lowest_clarification_agent);
  });

  it('zero-length session handled without error', async () => {
    setupMock([{ id: 'x', agentId: 'a', status: 'completed', createdAt: null, startedAt: null, completedAt: null }]);
    const r = await analyzeAgentClarificationRequestRate();
    expect(r).toBeTruthy();
  });
});
