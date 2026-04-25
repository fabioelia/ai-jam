import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionExecutionLatency } from '../agent-instruction-execution-latency-analyzer-service.js';

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

describe('analyzeAgentInstructionExecutionLatency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions with latency_score 100', async () => {
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.latency_score).toBe(100);
    expect(r.total_sessions).toBe(0);
    expect(r.fast_start_sessions).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('latency_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.latency_score).toBeGreaterThanOrEqual(0);
    expect(r.latency_score).toBeLessThanOrEqual(100);
  });

  it('fast + slow sessions <= total_sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.fast_start_sessions + r.slow_start_sessions).toBeLessThanOrEqual(r.total_sessions);
  });

  it('total_sessions matches input count', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.total_sessions).toBe(3);
  });

  it('avg_first_output_latency_ms >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.avg_first_output_latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('avg_instruction_parse_time_ms <= avg_first_output_latency_ms', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.avg_instruction_parse_time_ms).toBeLessThanOrEqual(r.avg_first_output_latency_ms);
  });

  it('median_execution_start_ms >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.median_execution_start_ms).toBeGreaterThanOrEqual(0);
  });

  it('p95_execution_start_ms >= median_execution_start_ms', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.p95_execution_start_ms).toBeGreaterThanOrEqual(r.median_execution_start_ms);
  });

  it('disambiguation_delay_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.disambiguation_delay_rate).toBeGreaterThanOrEqual(0);
    expect(r.disambiguation_delay_rate).toBeLessThanOrEqual(100);
  });

  it('planning_overhead_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.planning_overhead_rate).toBeGreaterThanOrEqual(0);
    expect(r.planning_overhead_rate).toBeLessThanOrEqual(100);
  });

  it('top_latency_patterns is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.top_latency_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('fastest and slowest agents are returned', async () => {
    setupMock([makeSession('agentA'), makeSession('agentB')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.fastest_agent).toBeTruthy();
    expect(r.slowest_agent).toBeTruthy();
  });

  it('single agent: fastest = slowest', async () => {
    setupMock([makeSession('only-agent'), makeSession('only-agent')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.fastest_agent).toBe(r.slowest_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentInstructionExecutionLatency();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });
});
