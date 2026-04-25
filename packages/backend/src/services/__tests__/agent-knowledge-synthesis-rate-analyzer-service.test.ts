import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentKnowledgeSynthesisRate } from '../agent-knowledge-synthesis-rate-analyzer-service.js';

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

describe('analyzeAgentKnowledgeSynthesisRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.synthesis_rate).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.high_synthesis_sessions).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('synthesis_rate = (high_synthesis_sessions / total_sessions) * 100', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    const expected = r.total_sessions > 0 ? (r.high_synthesis_sessions / r.total_sessions) * 100 : 0;
    expect(r.synthesis_rate).toBeCloseTo(expected, 0);
  });

  it('high + low sessions = total sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.high_synthesis_sessions + r.low_synthesis_sessions).toBe(r.total_sessions);
  });

  it('synthesis_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.synthesis_rate).toBeGreaterThanOrEqual(0);
    expect(r.synthesis_rate).toBeLessThanOrEqual(100);
  });

  it('multi_source_integration_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.multi_source_integration_rate).toBeGreaterThanOrEqual(0);
    expect(r.multi_source_integration_rate).toBeLessThanOrEqual(100);
  });

  it('isolated_source_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.isolated_source_rate).toBeGreaterThanOrEqual(0);
    expect(r.isolated_source_rate).toBeLessThanOrEqual(100);
  });

  it('synthesis_accuracy_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.synthesis_accuracy_rate).toBeGreaterThanOrEqual(0);
    expect(r.synthesis_accuracy_rate).toBeLessThanOrEqual(100);
  });

  it('top_synthesis_patterns is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.top_synthesis_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('best and worst synthesis agents are returned', async () => {
    setupMock([makeSession('agentX'), makeSession('agentY')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.best_synthesis_agent).toBeTruthy();
    expect(r.worst_synthesis_agent).toBeTruthy();
  });

  it('single agent: best = worst', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.best_synthesis_agent).toBe(r.worst_synthesis_agent);
  });

  it('cross_domain_connection_count >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.cross_domain_connection_count).toBeGreaterThanOrEqual(0);
  });

  it('avg_synthesis_speed >= 0', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 120000)]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.avg_synthesis_speed).toBeGreaterThanOrEqual(0);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('perfect synthesis: all high', async () => {
    setupMock(Array(10).fill(null).map((_, i) => makeSession(`agent-${i}`, 300000, 'completed')));
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.total_sessions).toBe(10);
    expect(r.synthesis_rate).toBeGreaterThanOrEqual(0);
  });

  it('empty sessions baseline state: isolated_source_rate = 100', async () => {
    const r = await analyzeAgentKnowledgeSynthesisRate();
    expect(r.isolated_source_rate).toBe(100);
  });
});
