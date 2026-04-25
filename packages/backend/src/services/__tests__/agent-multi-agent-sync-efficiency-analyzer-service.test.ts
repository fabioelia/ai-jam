import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentMultiAgentSyncEfficiencyAnalyzer } from '../agent-multi-agent-sync-efficiency-analyzer-service.js';

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

describe('analyzeAgentMultiAgentSyncEfficiencyAnalyzer', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgSyncEfficiencyScore');
    expect(report).toHaveProperty('highConflictAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgSyncEfficiencyScore is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(report.fleetAvgSyncEfficiencyScore).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgSyncEfficiencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(report.fleetAvgSyncEfficiencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgSyncEfficiencyScore).toBeLessThanOrEqual(100);
  });

  it('syncEfficiencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.syncEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.syncEfficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('conflictRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.conflictRate).toBeGreaterThanOrEqual(0);
      expect(m.conflictRate).toBeLessThanOrEqual(100);
    }
  });

  it('stateConsistencyRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.stateConsistencyRate).toBeGreaterThanOrEqual(0);
      expect(m.stateConsistencyRate).toBeLessThanOrEqual(100);
    }
  });

  it('contextSharingLatency is positive number', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextSharingLatency).toBeGreaterThan(0);
    }
  });

  it('coordinationEvents is non-negative integer', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.coordinationEvents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.coordinationEvents)).toBe(true);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    const valid = ['improving', 'stable', 'degrading'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (const m of report.metrics) {
      if (m.syncEfficiencyScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.syncEfficiencyScore >= 65) expect(m.rating).toBe('good');
      else if (m.syncEfficiencyScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by syncEfficiencyScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].syncEfficiencyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].syncEfficiencyScore);
    }
  });

  it('highConflictAgents counts agents with conflictRate > 30', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
    const expected = report.metrics.filter(m => m.conflictRate > 30).length;
    expect(report.highConflictAgents).toBe(expected);
  });
});
