import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentResponseLatencyAnalyzer } from '../agent-response-latency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

const NOW = Date.now();

function makeSession(agentId: string, idx: number, durationMs: number | null) {
  const startedAt = new Date(NOW - idx * 3600000);
  return {
    id: `session-${agentId}-${idx}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: startedAt,
    startedAt,
    completedAt: durationMs != null ? new Date(startedAt.getTime() + durationMs) : null,
    status: durationMs != null ? 'completed' : 'failed',
    durationMs,
  };
}

function makeFastSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => makeSession(agentId, i, 500)); // 500ms = fast
}

function makeSlowSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => makeSession(agentId, i, 60000)); // 60s = very slow
}

function makeNormalSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => makeSession(agentId, i, 2000)); // 2s = normal
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentResponseLatencyAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeFastSessions('agent1', 5));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('avg_latency_ms');
    expect(report).toHaveProperty('total_sessions');
    expect(report).toHaveProperty('fast_rate');
    expect(report).toHaveProperty('normal_rate');
    expect(report).toHaveProperty('slow_rate');
    expect(report).toHaveProperty('very_slow_rate');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('fastest_agent');
    expect(report).toHaveProperty('slowest_agent');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.total_sessions).toBe(0);
    expect(report.avg_latency_ms).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeFastSessions('agentA', 3),
      ...makeFastSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('fast sessions yield fast_rate = 100', async () => {
    (db.limit as any).mockResolvedValue(makeFastSessions('speedy', 10));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.fast_rate).toBe(100);
    expect(report.slow_rate).toBe(0);
    expect(report.very_slow_rate).toBe(0);
  });

  it('very slow sessions yield very_slow_rate = 100', async () => {
    (db.limit as any).mockResolvedValue(makeSlowSessions('tortoise', 10));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.very_slow_rate).toBe(100);
    expect(report.fast_rate).toBe(0);
  });

  it('normal sessions yield normal_rate = 100', async () => {
    (db.limit as any).mockResolvedValue(makeNormalSessions('mid', 8));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.normal_rate).toBe(100);
  });

  it('avg_latency_ms matches session durations for fast sessions', async () => {
    (db.limit as any).mockResolvedValue(makeFastSessions('fast', 5));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.avg_latency_ms).toBe(500);
  });

  it('metrics sorted ascending by avgLatencyMs', async () => {
    const sessions = [
      ...makeSlowSessions('slow', 5),
      ...makeFastSessions('fast', 5),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].avgLatencyMs).toBeLessThanOrEqual(report.metrics[1].avgLatencyMs);
    }
  });

  it('fastest_agent is first metric agentId', async () => {
    const sessions = [
      ...makeSlowSessions('slow', 5),
      ...makeFastSessions('fast', 5),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.fastest_agent).toBe(report.metrics[0].agentId);
  });

  it('slowest_agent is last metric agentId', async () => {
    const sessions = [
      ...makeSlowSessions('slow', 5),
      ...makeFastSessions('fast', 5),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.slowest_agent).toBe(report.metrics[report.metrics.length - 1].agentId);
  });

  it('trend is valid enum', async () => {
    (db.limit as any).mockResolvedValue(makeFastSessions('agent1', 5));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('improving trend when fast_rate >= 60', async () => {
    (db.limit as any).mockResolvedValue(makeFastSessions('fleet', 10));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.trend).toBe('improving');
  });

  it('degrading trend when very slow sessions dominate', async () => {
    (db.limit as any).mockResolvedValue(makeSlowSessions('sluggish', 10));
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.trend).toBe('degrading');
  });

  it('rate fields are 0–100', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeFastSessions('a', 3),
      ...makeNormalSessions('b', 3),
      ...makeSlowSessions('c', 3),
    ]);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    for (const rate of [report.fast_rate, report.normal_rate, report.slow_rate, report.very_slow_rate]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    }
  });

  it('single session handled correctly', async () => {
    (db.limit as any).mockResolvedValue([makeSession('solo', 0, 500)]);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.metrics).toHaveLength(1);
    expect(report.total_sessions).toBe(1);
  });

  it('sessions without timing data use 3000ms proxy', async () => {
    const s = makeFastSessions('agent', 5);
    s.forEach(sess => { sess.completedAt = null; sess.durationMs = null; });
    (db.limit as any).mockResolvedValue(s);
    const report = await analyzeAgentResponseLatencyAnalyzer();
    expect(report.avg_latency_ms).toBe(3000);
  });
});
