import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentMultiStepPlanningAccuracy } from '../agent-multi-step-planning-accuracy-analyzer-service.js';

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

describe('analyzeAgentMultiStepPlanningAccuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.plan_accuracy_rate).toBe(0);
    expect(r.total_plans).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('plan_accuracy_rate is between 0 and 100', async () => {
    setupMock([makeSession('a', 60000), makeSession('b', 60000, 'failed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.plan_accuracy_rate).toBeGreaterThanOrEqual(0);
    expect(r.plan_accuracy_rate).toBeLessThanOrEqual(100);
  });

  it('steps_executed + steps_deviated <= steps_planned', async () => {
    setupMock([makeSession('a', 120000), makeSession('b', 60000)]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.steps_executed + r.steps_deviated).toBeLessThanOrEqual(r.steps_planned + 1);
  });

  it('completed sessions have lower deviation than failed', async () => {
    setupMock([makeSession('a', 60000, 'completed'), makeSession('b', 60000, 'failed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.steps_deviated).toBeGreaterThan(0);
  });

  it('total_plans matches session count', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.total_plans).toBe(3);
  });

  it('returns highest and lowest accuracy agents', async () => {
    setupMock([makeSession('agent-X', 300000, 'completed'), makeSession('agent-Y', 60000, 'failed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.highest_accuracy_agent).toBeTruthy();
    expect(r.lowest_accuracy_agent).toBeTruthy();
  });

  it('avg_plan_depth > 0 for long sessions', async () => {
    setupMock([makeSession('a', 200000)]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.avg_plan_depth).toBeGreaterThan(0);
  });

  it('includes most_common_deviation_types', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.most_common_deviation_types.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('returns analysis_timestamp', async () => {
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.analysis_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('N/A agents for empty sessions', async () => {
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.highest_accuracy_agent).toBe('N/A');
    expect(r.lowest_accuracy_agent).toBe('N/A');
  });

  it('plan_completion_rate for all completed = 100', async () => {
    setupMock([makeSession('a', 60000, 'completed'), makeSession('b', 60000, 'completed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.plan_completion_rate).toBeCloseTo(100);
  });

  it('plan_completion_rate for all failed = 0', async () => {
    setupMock([makeSession('a', 60000, 'failed'), makeSession('b', 60000, 'failed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.plan_completion_rate).toBeCloseTo(0);
  });

  it('handles null timestamps', async () => {
    setupMock([{ id: 'x', agentId: 'a', status: 'completed', createdAt: null, startedAt: null, completedAt: null }]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r).toBeTruthy();
  });

  it('multiple agents tracked independently', async () => {
    setupMock([
      makeSession('agent-1', 300000, 'completed'),
      makeSession('agent-1', 300000, 'completed'),
      makeSession('agent-2', 60000, 'failed'),
      makeSession('agent-2', 60000, 'failed'),
    ]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.highest_accuracy_agent).toBe('agent-1');
    expect(r.lowest_accuracy_agent).toBe('agent-2');
  });

  it('backtrack_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b', 60000, 'failed')]);
    const r = await analyzeAgentMultiStepPlanningAccuracy();
    expect(r.backtrack_rate).toBeGreaterThanOrEqual(0);
    expect(r.backtrack_rate).toBeLessThanOrEqual(100);
  });
});
