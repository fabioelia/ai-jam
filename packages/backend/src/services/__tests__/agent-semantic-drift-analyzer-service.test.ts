import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSemanticDrift } from '../agent-semantic-drift-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, errorRate = 0.2) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: i % Math.max(1, Math.round(1 / errorRate)) === 0 ? 'error' : 'completed',
    retryCount: i % 4 === 0 ? 1 : 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentSemanticDrift', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentSemanticDrift();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('driftScore');
    expect(report).toHaveProperty('driftRate');
    expect(report).toHaveProperty('averageDriftMagnitude');
    expect(report).toHaveProperty('peakDriftSession');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('mostStableAgent');
    expect(report).toHaveProperty('mostDriftedAgent');
    expect(report).toHaveProperty('fleetAvgDriftScore');
    expect(report).toHaveProperty('highDriftAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions returns zeros', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentSemanticDrift();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgDriftScore).toBe(0);
    expect(report.highDriftAgents).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentSemanticDrift();
    expect(report.metrics).toHaveLength(0);
  });

  it('driftScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 5), ...makeSessions('a2', 5)]);
    const report = await analyzeAgentSemanticDrift();
    expect(report.fleetAvgDriftScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgDriftScore).toBeLessThanOrEqual(100);
  });

  it('per-agent driftScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentSemanticDrift();
    for (const m of report.metrics) {
      expect(m.driftScore).toBeGreaterThanOrEqual(0);
      expect(m.driftScore).toBeLessThanOrEqual(100);
    }
  });

  it('driftRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentSemanticDrift();
    for (const m of report.metrics) {
      expect(m.driftRate).toBeGreaterThanOrEqual(0);
      expect(m.driftRate).toBeLessThanOrEqual(100);
    }
  });

  it('sessionsWithDrift <= totalSessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentSemanticDrift();
    for (const m of report.metrics) {
      expect(m.sessionsWithDrift).toBeLessThanOrEqual(m.totalSessions);
    }
  });

  it('trend is valid value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentSemanticDrift();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating reflects driftScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentSemanticDrift();
    for (const m of report.metrics) {
      if (m.driftScore < 20) expect(m.rating).toBe('stable');
      else if (m.driftScore < 40) expect(m.rating).toBe('mild');
      else if (m.driftScore < 70) expect(m.rating).toBe('moderate');
      else expect(m.rating).toBe('severe');
    }
  });

  it('highDriftAgents counts correctly', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentSemanticDrift();
    const expected = report.metrics.filter(m => m.driftScore >= 70).length;
    expect(report.highDriftAgents).toBe(expected);
  });

  it('metrics sorted ascending by driftScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentSemanticDrift();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].driftScore).toBeLessThanOrEqual(report.metrics[i].driftScore);
    }
  });

  it('multiple agents get separate metrics', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentSemanticDrift();
    expect(report.metrics).toHaveLength(2);
  });

  it('mostStableAgent and mostDriftedAgent are strings', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentSemanticDrift();
    expect(typeof report.mostStableAgent).toBe('string');
    expect(typeof report.mostDriftedAgent).toBe('string');
  });

  it('averageDriftMagnitude non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentSemanticDrift();
    for (const m of report.metrics) {
      expect(m.averageDriftMagnitude).toBeGreaterThanOrEqual(0);
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentSemanticDrift();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('peakDriftSession is string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentSemanticDrift();
    expect(typeof report.peakDriftSession).toBe('string');
  });
});
