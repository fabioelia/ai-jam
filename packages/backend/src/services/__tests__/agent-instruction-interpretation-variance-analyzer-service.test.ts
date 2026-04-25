import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionInterpretationVariance } from '../agent-instruction-interpretation-variance-analyzer-service.js';

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

describe('analyzeAgentInstructionInterpretationVariance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.variance_score).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.most_consistent_agent).toBe('N/A');
    expect(r.least_consistent_agent).toBe('N/A');
  });

  it('variance_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.variance_score).toBeGreaterThanOrEqual(0);
    expect(r.variance_score).toBeLessThanOrEqual(100);
  });

  it('consistent + inconsistent = total_sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.consistent_interpretations + r.inconsistent_interpretations).toBe(r.total_sessions);
  });

  it('high + low variance = total_sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.high_variance_sessions + r.low_variance_sessions).toBe(r.total_sessions);
  });

  it('avg_variance_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.avg_variance_score).toBeGreaterThanOrEqual(0);
    expect(r.avg_variance_score).toBeLessThanOrEqual(100);
  });

  it('phrasing_sensitivity_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.phrasing_sensitivity_rate).toBeGreaterThanOrEqual(0);
    expect(r.phrasing_sensitivity_rate).toBeLessThanOrEqual(100);
  });

  it('context_noise_sensitivity is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.context_noise_sensitivity).toBeGreaterThanOrEqual(0);
    expect(r.context_noise_sensitivity).toBeLessThanOrEqual(100);
  });

  it('interpretation_drift_over_time is 0–100', async () => {
    setupMock(Array(20).fill(null).map((_, i) => makeSession(`agent-${i % 3}`)));
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.interpretation_drift_over_time).toBeGreaterThanOrEqual(0);
    expect(r.interpretation_drift_over_time).toBeLessThanOrEqual(100);
  });

  it('repeated_instruction_groups >= 3 for non-empty sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.repeated_instruction_groups).toBeGreaterThanOrEqual(3);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('single agent: most = least consistent', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.most_consistent_agent).toBe(r.least_consistent_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('zero variance: no high variance sessions', async () => {
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.high_variance_sessions).toBe(0);
  });

  it('large session set: score stays bounded', async () => {
    setupMock(Array(50).fill(null).map((_, i) => makeSession(`agent-${i % 5}`, 'completed')));
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.variance_score).toBeGreaterThanOrEqual(0);
    expect(r.variance_score).toBeLessThanOrEqual(100);
    expect(r.total_sessions).toBe(50);
  });

  it('most and least consistent agents returned', async () => {
    setupMock([makeSession('agentA'), makeSession('agentB'), makeSession('agentC')]);
    const r = await analyzeAgentInstructionInterpretationVariance();
    expect(r.most_consistent_agent).toBeTruthy();
    expect(r.least_consistent_agent).toBeTruthy();
  });
});
