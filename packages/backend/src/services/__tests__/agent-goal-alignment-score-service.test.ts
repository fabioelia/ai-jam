import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentGoalAlignment } from '../agent-goal-alignment-score-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentGoalAlignment', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentGoalAlignment();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgAlignmentScore');
    expect(report).toHaveProperty('lowAlignmentAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentGoalAlignment();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAlignmentScore).toBe(0);
  });

  it('excludes agent with 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentGoalAlignment();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agent with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 3));
    const report = await analyzeAgentGoalAlignment();
    expect(report.metrics).toHaveLength(1);
  });

  it('alignmentScore clamped to 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 10));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(m.alignmentScore).toBeGreaterThanOrEqual(0);
      expect(m.alignmentScore).toBeLessThanOrEqual(100);
    }
  });

  it('fleetAvgAlignmentScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentGoalAlignment();
    expect(report.fleetAvgAlignmentScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgAlignmentScore).toBeLessThanOrEqual(100);
  });

  it('lowAlignmentAgents counts agents with alignmentScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentGoalAlignment();
    const expected = report.metrics.filter(m => m.alignmentScore < 50).length;
    expect(report.lowAlignmentAgents).toBe(expected);
  });

  it('goalCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(m.goalCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.goalCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('deviationRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(m.deviationRate).toBeGreaterThanOrEqual(0);
      expect(m.deviationRate).toBeLessThanOrEqual(100);
    }
  });

  it('midTaskAbandonmentRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(m.midTaskAbandonmentRate).toBeGreaterThanOrEqual(0);
      expect(m.midTaskAbandonmentRate).toBeLessThanOrEqual(100);
    }
  });

  it('alignedSessions is non-negative integer', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 5));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(m.alignedSessions).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.alignedSessions)).toBe(true);
    }
  });

  it('trend is one of improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-h', 5));
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentGoalAlignment();
    for (const m of report.metrics) {
      if (m.alignmentScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.alignmentScore >= 65) expect(m.rating).toBe('good');
      else if (m.alignmentScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-i', 3));
    const report = await analyzeAgentGoalAlignment();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by alignmentScore (worst first)', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessions('a2', 4),
      ...makeSessions('a3', 4),
    ]);
    const report = await analyzeAgentGoalAlignment();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].alignmentScore).toBeLessThanOrEqual(report.metrics[i].alignmentScore);
    }
  });
});
