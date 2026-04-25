import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskPrioritizationAccuracy } from '../agent-task-prioritization-accuracy-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `sess-${agentId}-${i}`,
    agentId,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentTaskPrioritizationAccuracy', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgPrioritizationScore');
    expect(report).toHaveProperty('poorPrioritizers');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgPrioritizationScore is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report.fleetAvgPrioritizationScore).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgPrioritizationScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report.fleetAvgPrioritizationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgPrioritizationScore).toBeLessThanOrEqual(100);
  });

  it('highPriorityCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    for (const m of report.metrics) {
      expect(m.highPriorityCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.highPriorityCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('priorityInversionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    for (const m of report.metrics) {
      expect(m.priorityInversionRate).toBeGreaterThanOrEqual(0);
      expect(m.priorityInversionRate).toBeLessThanOrEqual(100);
    }
  });

  it('urgencyResponseTime > 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    for (const m of report.metrics) {
      expect(m.urgencyResponseTime).toBeGreaterThan(0);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    const validTrends = ['improving', 'stable', 'degrading'];
    for (const m of report.metrics) {
      expect(validTrends).toContain(m.trend);
    }
  });

  it('accuracy correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    for (const m of report.metrics) {
      if (m.prioritizationScore >= 80) expect(m.accuracy).toBe('excellent');
      else if (m.prioritizationScore >= 65) expect(m.accuracy).toBe('good');
      else if (m.prioritizationScore >= 50) expect(m.accuracy).toBe('fair');
      else expect(m.accuracy).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by prioritizationScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].prioritizationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].prioritizationScore);
    }
  });

  it('poorPrioritizers counts agents with score < 50', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    const expected = report.metrics.filter(m => m.prioritizationScore < 50).length;
    expect(report.poorPrioritizers).toBe(expected);
  });

  it('totalTasksAnalyzed matches session count per agent', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 4));
    const report = await analyzeAgentTaskPrioritizationAccuracy();
    expect(report.metrics[0].totalTasksAnalyzed).toBe(4);
  });
});
