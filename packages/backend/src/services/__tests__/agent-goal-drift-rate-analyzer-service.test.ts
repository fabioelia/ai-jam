import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentGoalDriftRateAnalyzer } from '../agent-goal-drift-rate-analyzer-service.js';

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
    id: `session-${agentId}-${i}`,
    agentId,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(),
    status: 'completed',
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentGoalDriftRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 3));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgGoalStabilityScore');
    expect(report).toHaveProperty('highDriftAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions => empty metrics, fleetAvgGoalStabilityScore=0', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgGoalStabilityScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-solo', 1));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgGoalStabilityScore is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    expect(report.fleetAvgGoalStabilityScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgGoalStabilityScore).toBeLessThanOrEqual(100);
  });

  it('driftRate is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.driftRate).toBeGreaterThanOrEqual(0);
      expect(m.driftRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgDriftMagnitude is positive (>= 1)', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgDriftMagnitude).toBeGreaterThanOrEqual(1);
    }
  });

  it('onTaskCompletionRate is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.onTaskCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.onTaskCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('spontaneousRescoping is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.spontaneousRescoping).toBeGreaterThanOrEqual(0);
      expect(m.spontaneousRescoping).toBeLessThanOrEqual(100);
    }
  });

  it('driftPattern is one of scope-creep/goal-substitution/tangent-pursuit/stable', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(['scope-creep', 'goal-substitution', 'tangent-pursuit', 'stable']).toContain(m.driftPattern);
    }
  });

  it('rating is one of excellent/good/fair/poor', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by goalStabilityScore', async () => {
    const sessions = [
      ...makeSessions('agent-a', 4),
      ...makeSessions('agent-b', 4),
      ...makeSessions('agent-c', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].goalStabilityScore).toBeLessThanOrEqual(
        report.metrics[report.metrics.length - 1].goalStabilityScore
      );
    }
  });

  it('highDriftAgents counts only agents with driftRate > 25', async () => {
    const sessions = [
      ...makeSessions('agent-a', 4),
      ...makeSessions('agent-b', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentGoalDriftRateAnalyzer();
    const expected = report.metrics.filter(m => m.driftRate > 25).length;
    expect(report.highDriftAgents).toBe(expected);
  });
});
