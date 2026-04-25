import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAttentionAllocationEfficiency } from '../agent-attention-allocation-efficiency-analyzer-service.js';

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

describe('analyzeAgentAttentionAllocationEfficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.allocation_efficiency_rate).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.optimal_attention_sessions).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('optimal + misallocated <= total_sessions', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.optimal_attention_sessions + r.misallocated_attention_sessions).toBeLessThanOrEqual(r.total_sessions);
  });

  it('allocation_efficiency_rate = (optimal / total) * 100', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 60000), makeSession('c', 60000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    const expected = r.total_sessions > 0 ? (r.optimal_attention_sessions / r.total_sessions) * 100 : 0;
    expect(r.allocation_efficiency_rate).toBeCloseTo(expected, 0);
  });

  it('avg_allocation_efficiency is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.avg_allocation_efficiency).toBeGreaterThanOrEqual(0);
    expect(r.avg_allocation_efficiency).toBeLessThanOrEqual(100);
  });

  it('includes top_misallocation_patterns', async () => {
    setupMock([makeSession('a', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.top_misallocation_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('returns best and worst allocation agents', async () => {
    setupMock([makeSession('x', 300000), makeSession('y', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.best_allocation_agent).toBeTruthy();
    expect(r.worst_allocation_agent).toBeTruthy();
  });

  it('single agent returns same for best and worst', async () => {
    setupMock([makeSession('solo', 300000), makeSession('solo', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.best_allocation_agent).toBe(r.worst_allocation_agent);
  });

  it('perfect allocation — short completed sessions', async () => {
    setupMock(Array(4).fill(null).map((_, i) => makeSession(`a${i}`, 60000, 'completed')));
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.allocation_efficiency_rate).toBeGreaterThan(50);
  });

  it('poor allocation — very long sessions', async () => {
    setupMock(Array(4).fill(null).map((_, i) => makeSession(`a${i}`, 7200000, 'running')));
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.misallocated_attention_sessions).toBeGreaterThan(0);
  });

  it('attention_waste_ratio is 0–1', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.attention_waste_ratio).toBeGreaterThanOrEqual(0);
    expect(r.attention_waste_ratio).toBeLessThanOrEqual(1);
  });

  it('primary_task_focus_rate is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.primary_task_focus_rate).toBeGreaterThanOrEqual(0);
    expect(r.primary_task_focus_rate).toBeLessThanOrEqual(100);
  });

  it('total_sessions matches session count', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.total_sessions).toBe(3);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a', 300000), agentId: null }]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is a valid ISO string', async () => {
    setupMock([makeSession('a', 300000)]);
    const r = await analyzeAgentAttentionAllocationEfficiency();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });
});
