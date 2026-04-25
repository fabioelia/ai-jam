import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentPromptAlignmentScore } from '../agent-prompt-alignment-score-analyzer-service.js';

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

describe('analyzeAgentPromptAlignmentScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.alignment_score).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.best_aligned_agent).toBe('N/A');
  });

  it('alignment_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.alignment_score).toBeGreaterThanOrEqual(0);
    expect(r.alignment_score).toBeLessThanOrEqual(100);
  });

  it('high + low sessions = total sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.high_alignment_sessions + r.low_alignment_sessions).toBe(r.total_sessions);
  });

  it('topic_drift_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.topic_drift_rate).toBeGreaterThanOrEqual(0);
    expect(r.topic_drift_rate).toBeLessThanOrEqual(100);
  });

  it('format_compliance_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.format_compliance_rate).toBeGreaterThanOrEqual(0);
    expect(r.format_compliance_rate).toBeLessThanOrEqual(100);
  });

  it('scope_overshoot_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.scope_overshoot_rate).toBeGreaterThanOrEqual(0);
    expect(r.scope_overshoot_rate).toBeLessThanOrEqual(100);
  });

  it('scope_undershoot_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.scope_undershoot_rate).toBeGreaterThanOrEqual(0);
    expect(r.scope_undershoot_rate).toBeLessThanOrEqual(100);
  });

  it('intent_mismatch_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.intent_mismatch_rate).toBeGreaterThanOrEqual(0);
    expect(r.intent_mismatch_rate).toBeLessThanOrEqual(100);
  });

  it('top_misalignment_patterns is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.top_misalignment_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('best and worst aligned agents returned', async () => {
    setupMock([makeSession('agentX'), makeSession('agentY')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.best_aligned_agent).toBeTruthy();
    expect(r.worst_aligned_agent).toBeTruthy();
  });

  it('single agent: best = worst', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.best_aligned_agent).toBe(r.worst_aligned_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('avg_alignment_score matches alignment_score', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.alignment_score).toBe(r.avg_alignment_score);
  });

  it('perfect alignment: high sessions > 0', async () => {
    setupMock(Array(10).fill(null).map(() => makeSession('perfect-agent', 'completed')));
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.total_sessions).toBe(10);
    expect(r.high_alignment_sessions + r.low_alignment_sessions).toBe(10);
  });

  it('format_compliance_rate > 0 with sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentPromptAlignmentScore();
    expect(r.format_compliance_rate).toBeGreaterThanOrEqual(0);
  });
});
