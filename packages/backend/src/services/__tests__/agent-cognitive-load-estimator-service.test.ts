import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateAgentCognitiveLoad } from '../agent-cognitive-load-estimator-service.js';

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

describe('estimateAgentCognitiveLoad', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await estimateAgentCognitiveLoad();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgCognitiveLoad');
    expect(report).toHaveProperty('overloadedAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await estimateAgentCognitiveLoad();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgCognitiveLoad).toBe(0);
  });

  it('excludes agent with 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await estimateAgentCognitiveLoad();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agent with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 3));
    const report = await estimateAgentCognitiveLoad();
    expect(report.metrics).toHaveLength(1);
  });

  it('cognitiveLoadScore clamped to 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 10));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(m.cognitiveLoadScore).toBeGreaterThanOrEqual(0);
      expect(m.cognitiveLoadScore).toBeLessThanOrEqual(100);
    }
  });

  it('fleetAvgCognitiveLoad in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await estimateAgentCognitiveLoad();
    expect(report.fleetAvgCognitiveLoad).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCognitiveLoad).toBeLessThanOrEqual(100);
  });

  it('overloadedAgents counts agents with cognitiveLoadScore > 75', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await estimateAgentCognitiveLoad();
    const expected = report.metrics.filter(m => m.cognitiveLoadScore > 75).length;
    expect(report.overloadedAgents).toBe(expected);
  });

  it('taskComplexityIndex is positive and in 0-10 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(m.taskComplexityIndex).toBeGreaterThan(0);
      expect(m.taskComplexityIndex).toBeLessThanOrEqual(10);
    }
  });

  it('concurrentContextCount is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(m.concurrentContextCount).toBeGreaterThan(0);
    }
  });

  it('contextSwitchRate is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(m.contextSwitchRate).toBeGreaterThan(0);
    }
  });

  it('overloadEvents is non-negative integer', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 5));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(m.overloadEvents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.overloadEvents)).toBe(true);
    }
  });

  it('trend is one of increasing|stable|decreasing', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-h', 5));
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      expect(['increasing', 'stable', 'decreasing']).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await estimateAgentCognitiveLoad();
    for (const m of report.metrics) {
      if (m.cognitiveLoadScore >= 75) expect(m.rating).toBe('critical');
      else if (m.cognitiveLoadScore >= 55) expect(m.rating).toBe('high');
      else if (m.cognitiveLoadScore >= 35) expect(m.rating).toBe('moderate');
      else expect(m.rating).toBe('low');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-i', 3));
    const report = await estimateAgentCognitiveLoad();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by cognitiveLoadScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessions('a2', 4),
      ...makeSessions('a3', 4),
    ]);
    const report = await estimateAgentCognitiveLoad();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].cognitiveLoadScore).toBeGreaterThanOrEqual(report.metrics[i].cognitiveLoadScore);
    }
  });
});
