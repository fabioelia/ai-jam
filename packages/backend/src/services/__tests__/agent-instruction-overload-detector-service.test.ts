import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionOverloadDetector } from '../agent-instruction-overload-detector-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed', durationMs = 60000) {
  const startedAt = new Date(createdAt.getTime());
  const completedAt = new Date(createdAt.getTime() + durationMs);
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentInstructionOverloadDetector', () => {
  it('returns zero score for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.overload_score).toBe(0);
    expect(report.total_sessions).toBe(0);
  });

  it('returns all required top-level fields', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(typeof report.overload_score).toBe('number');
    expect(typeof report.avg_instructions_per_session).toBe('number');
    expect(typeof report.overloaded_sessions).toBe('number');
    expect(typeof report.total_sessions).toBe('number');
    expect(typeof report.overload_threshold).toBe('number');
    expect(typeof report.performance_degradation_rate).toBe('number');
    expect(typeof report.error_rate_under_overload).toBe('number');
    expect(typeof report.error_rate_normal).toBe('number');
    expect(typeof report.optimal_instruction_range).toBe('object');
    expect(typeof report.trend).toBe('string');
    expect(typeof report.most_overloaded_agent).toBe('string');
    expect(typeof report.least_overloaded_agent).toBe('string');
    expect(typeof report.analysis_timestamp).toBe('string');
  });

  it('optimal_instruction_range has min and max', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(typeof report.optimal_instruction_range.min).toBe('number');
    expect(typeof report.optimal_instruction_range.max).toBe('number');
    expect(report.optimal_instruction_range.min).toBeLessThan(report.optimal_instruction_range.max);
  });

  it('overload_score is in 0-100 range', async () => {
    const now = new Date();
    setupMock([
      makeSession('agent-a', now, 'completed', 200000),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'completed', 10000),
    ]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.overload_score).toBeGreaterThanOrEqual(0);
    expect(report.overload_score).toBeLessThanOrEqual(100);
  });

  it('all sessions overloaded scenario', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'failed', 200000)
    );
    setupMock(sessions);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.overload_score).toBe(100);
    expect(report.overloaded_sessions).toBe(5);
  });

  it('no overload scenario', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000), 'completed', 5000)
    );
    setupMock(sessions);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.overload_score).toBe(0);
    expect(report.overloaded_sessions).toBe(0);
  });

  it('threshold boundary: session exactly at threshold', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'completed', 100000)]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.overload_threshold).toBe(20);
    expect(typeof report.overloaded_sessions).toBe('number');
  });

  it('error_rate_under_overload higher than error_rate_normal when overloaded sessions fail', async () => {
    const now = new Date();
    const sessions = [
      makeSession('agent-a', now, 'failed', 200000),
      makeSession('agent-a', new Date(now.getTime() - 1000), 'completed', 5000),
    ];
    setupMock(sessions);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.error_rate_under_overload).toBeGreaterThanOrEqual(report.error_rate_normal);
  });

  it('performance_degradation_rate is non-negative', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-b', new Date(now.getTime() - 1000), 'failed', 200000)]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.performance_degradation_rate).toBeGreaterThanOrEqual(0);
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('total_sessions matches session count', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) => makeSession('agent-a', new Date(now.getTime() - i * 1000)));
    setupMock(sessions);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.total_sessions).toBe(6);
  });

  it('analysis_timestamp is valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(new Date(report.analysis_timestamp).toISOString()).toBe(report.analysis_timestamp);
  });

  it('most_overloaded_agent populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 200000), makeSession('agent-b', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.most_overloaded_agent).not.toBe('');
  });

  it('least_overloaded_agent populated when sessions exist', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now, 'failed', 200000), makeSession('agent-b', new Date(now.getTime() - 1000), 'completed', 5000)]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.least_overloaded_agent).not.toBe('');
  });

  it('empty sessions returns empty agent names', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.most_overloaded_agent).toBe('');
    expect(report.least_overloaded_agent).toBe('');
  });

  it('multiple agents: highest overload agent ranked first', async () => {
    const now = new Date();
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => makeSession('agent-heavy', new Date(now.getTime() - i * 1000), 'failed', 200000)),
      ...Array.from({ length: 4 }, (_, i) => makeSession('agent-light', new Date(now.getTime() - i * 1000), 'completed', 5000)),
    ];
    setupMock(sessions);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.most_overloaded_agent).toBe('agent-heavy');
    expect(report.least_overloaded_agent).toBe('agent-light');
  });

  it('handles single session without error', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentInstructionOverloadDetector();
    expect(report.total_sessions).toBe(1);
    expect(report.overload_score).toBeGreaterThanOrEqual(0);
  });
});
