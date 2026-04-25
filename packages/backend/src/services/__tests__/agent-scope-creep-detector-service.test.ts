import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectAgentScopeCreep } from '../agent-scope-creep-detector-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: 's1', agentId: 'agent-1', status: 'completed', startedAt: new Date(Date.now() - 10000), completedAt: new Date(Date.now() - 5000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's2', agentId: 'agent-1', status: 'completed', startedAt: new Date(Date.now() - 60000), completedAt: new Date(Date.now() - 15000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's3', agentId: 'agent-1', status: 'completed', startedAt: new Date(Date.now() - 30000), completedAt: new Date(Date.now() - 25000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's4', agentId: 'agent-2', status: 'completed', startedAt: new Date(Date.now() - 10000), completedAt: new Date(Date.now() - 2000), createdAt: new Date(), agentName: 'Bob' },
      { id: 's5', agentId: 'agent-2', status: 'completed', startedAt: new Date(Date.now() - 20000), completedAt: new Date(Date.now() - 12000), createdAt: new Date(), agentName: 'Bob' },
    ]),
  },
}));

import { db } from '../../db/connection.js';

const now = Date.now();

function makeSessions(agentId: string, count: number, durationMs: number = 5000) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: 'completed',
    startedAt: new Date(now - (i + 1) * 60000 - durationMs),
    completedAt: new Date(now - (i + 1) * 60000),
    createdAt: new Date(now - i * 3600000),
  }));
}

function makeSessionsWithOverrun(agentId: string, count: number) {
  // Half sessions are 3x longer (overrun)
  return Array.from({ length: count }, (_, i) => {
    const dur = i % 2 === 0 ? 30000 : 5000;
    return {
      id: `session-${agentId}-${i}`,
      agentId,
      agentName: `Agent ${agentId}`,
      status: 'completed',
      startedAt: new Date(now - (i + 1) * 120000 - dur),
      completedAt: new Date(now - (i + 1) * 120000),
      createdAt: new Date(now - i * 3600000),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectAgentScopeCreep', () => {
  it('returns valid report shape with metrics/fleetAvgScopeCreepScore/highRiskAgents/analysisTimestamp', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await detectAgentScopeCreep();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgScopeCreepScore');
    expect(report).toHaveProperty('highRiskAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgScopeCreepScore is a number', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await detectAgentScopeCreep();
    expect(typeof report.fleetAvgScopeCreepScore).toBe('number');
  });

  it('highRiskAgents counts agents with riskLevel high or critical', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessionsWithOverrun('a2', 6)]);
    const report = await detectAgentScopeCreep();
    const expected = report.metrics.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length;
    expect(report.highRiskAgents).toBe(expected);
  });

  it('scopeCreepScore is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 5));
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(m.scopeCreepScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('avgOverrunRatio is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 5));
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(m.avgOverrunRatio).toBeGreaterThan(0);
    }
  });

  it('outOfScopeTaskRate is between 0 and 100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessionsWithOverrun('a2', 4)]);
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(m.outOfScopeTaskRate).toBeGreaterThanOrEqual(0);
      expect(m.outOfScopeTaskRate).toBeLessThanOrEqual(100);
    }
  });

  it('resourceOveruseRate equals outOfScopeTaskRate', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(m.resourceOveruseRate).toBe(m.outOfScopeTaskRate);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('riskLevel is low|medium|high|critical', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessionsWithOverrun('a2', 4)]);
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      expect(['low', 'medium', 'high', 'critical']).toContain(m.riskLevel);
    }
  });

  it('riskLevel >= 75 is critical', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessionsWithOverrun('a2', 4)]);
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      if (m.scopeCreepScore >= 75) expect(m.riskLevel).toBe('critical');
    }
  });

  it('riskLevel < 25 is low', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await detectAgentScopeCreep();
    for (const m of report.metrics) {
      if (m.scopeCreepScore < 25) expect(m.riskLevel).toBe('low');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await detectAgentScopeCreep();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by scopeCreepScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessionsWithOverrun('a2', 4),
      ...makeSessions('a3', 4, 1000),
    ]);
    const report = await detectAgentScopeCreep();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].scopeCreepScore).toBeGreaterThanOrEqual(report.metrics[i].scopeCreepScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await detectAgentScopeCreep();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgScopeCreepScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await detectAgentScopeCreep();
    expect(report.metrics).toHaveLength(0);
  });

  it('totalSessions matches session count for agent', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-h', 6));
    const report = await detectAgentScopeCreep();
    expect(report.metrics[0].totalSessions).toBe(6);
  });
});
