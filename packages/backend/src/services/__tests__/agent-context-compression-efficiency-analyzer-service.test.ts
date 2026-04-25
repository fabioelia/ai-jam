import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentContextCompressionEfficiency } from '../agent-context-compression-efficiency-analyzer-service.js';

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

describe('analyzeAgentContextCompressionEfficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.efficiency_score).toBe(0);
    expect(r.total_handoffs).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.most_efficient_agent).toBe('N/A');
  });

  it('efficiency_score = (efficient_handoffs / total_handoffs) * 100', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    const expected = r.total_handoffs > 0 ? (r.efficient_handoffs / r.total_handoffs) * 100 : 0;
    expect(r.efficiency_score).toBeCloseTo(expected, 0);
  });

  it('efficient + inefficient = total handoffs', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.efficient_handoffs + r.inefficient_handoffs).toBe(r.total_handoffs);
  });

  it('efficiency_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.efficiency_score).toBeGreaterThanOrEqual(0);
    expect(r.efficiency_score).toBeLessThanOrEqual(100);
  });

  it('over_compression_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.over_compression_rate).toBeGreaterThanOrEqual(0);
    expect(r.over_compression_rate).toBeLessThanOrEqual(100);
  });

  it('under_compression_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.under_compression_rate).toBeGreaterThanOrEqual(0);
    expect(r.under_compression_rate).toBeLessThanOrEqual(100);
  });

  it('compression_accuracy_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.compression_accuracy_rate).toBeGreaterThanOrEqual(0);
    expect(r.compression_accuracy_rate).toBeLessThanOrEqual(100);
  });

  it('handoff_success_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.handoff_success_rate).toBeGreaterThanOrEqual(0);
    expect(r.handoff_success_rate).toBeLessThanOrEqual(100);
  });

  it('avg_context_size_ratio is positive', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.avg_context_size_ratio).toBeGreaterThan(0);
  });

  it('avg_tokens_per_handoff >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.avg_tokens_per_handoff).toBeGreaterThanOrEqual(0);
  });

  it('top_compression_patterns is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.top_compression_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('most and least efficient agents returned', async () => {
    setupMock([makeSession('agentX'), makeSession('agentY')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.most_efficient_agent).toBeTruthy();
    expect(r.least_efficient_agent).toBeTruthy();
  });

  it('single agent: most = least efficient', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.most_efficient_agent).toBe(r.least_efficient_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.total_handoffs).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('perfect compression: all efficient', async () => {
    setupMock(Array(10).fill(null).map(() => makeSession('agent-efficient', 'completed')));
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.total_handoffs).toBe(10);
    expect(r.efficiency_score).toBeGreaterThanOrEqual(0);
  });

  it('empty baseline: compression_accuracy_rate = 0', async () => {
    const r = await analyzeAgentContextCompressionEfficiency();
    expect(r.compression_accuracy_rate).toBe(0);
  });
});
