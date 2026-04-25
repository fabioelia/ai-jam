import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentGoalCompletionRateAnalyzer } from '../agent-goal-completion-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, id: string) {
  return { id, agentId, createdAt: new Date() };
}

describe('analyzeAgentGoalCompletionRateAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgGoalCompletionRate');
    expect(report).toHaveProperty('lowCompletionAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgGoalCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(report.fleetAvgGoalCompletionRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgGoalCompletionRate).toBeLessThanOrEqual(100);
  });

  it('lowCompletionAgents counts agents with rate < 50', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    const expected = report.metrics.filter(m => m.goalCompletionRate < 50).length;
    expect(report.lowCompletionAgents).toBe(expected);
  });

  it('goalCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.goalCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.goalCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('completedGoals + abandonedGoals + partialGoals === totalGoals', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.completedGoals + m.abandonedGoals + m.partialGoals).toBe(m.totalGoals);
    }
  });

  it('avgCompletionTime is a positive number', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgCompletionTime).toBeGreaterThan(0);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (const m of report.metrics) {
      if (m.goalCompletionRate >= 85) expect(m.rating).toBe('excellent');
      else if (m.goalCompletionRate >= 70) expect(m.rating).toBe('good');
      else if (m.goalCompletionRate >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by goalCompletionRate', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
      makeSession('a3', 's5'), makeSession('a3', 's6'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].goalCompletionRate).toBeGreaterThanOrEqual(report.metrics[i - 1].goalCompletionRate);
    }
  });

  it('empty sessions returns empty metrics array', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgGoalCompletionRate).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue([makeSession('a1', 's1')]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('multiple agents all have valid fields', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
    ]);
    const report = await analyzeAgentGoalCompletionRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
    for (const m of report.metrics) {
      expect(m.agentId).toBeDefined();
      expect(m.agentName).toBeDefined();
      expect(m.totalGoals).toBeGreaterThan(0);
    }
  });
});
