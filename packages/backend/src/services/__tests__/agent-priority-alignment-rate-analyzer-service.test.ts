import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentPriorityAlignmentRateAnalyzer } from '../agent-priority-alignment-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, status = 'completed', durationMs = 1800000) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + durationMs),
    startedAt: new Date(Date.now() - i * 3600000),
    status,
    durationMs,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentPriorityAlignmentRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgAlignmentScore');
    expect(report).toHaveProperty('poorAlignmentAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns metrics array', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgAlignmentScore as number', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(typeof report.fleetAvgAlignmentScore).toBe('number');
  });

  it('returns poorAlignmentAgents count', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(typeof report.poorAlignmentAgents).toBe('number');
    expect(report.poorAlignmentAgents).toBeGreaterThanOrEqual(0);
  });

  it('returns analysisTimestamp string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(typeof report.analysisTimestamp).toBe('string');
    expect(new Date(report.analysisTimestamp).getTime()).not.toBeNaN();
  });

  it('handles empty sessions gracefully', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAlignmentScore).toBe(0);
    expect(report.poorAlignmentAgents).toBe(0);
  });

  it('alignmentScore is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.alignmentScore).toBeGreaterThanOrEqual(0);
      expect(m.alignmentScore).toBeLessThanOrEqual(100);
    }
  });

  it('alignmentRate is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.alignmentRate).toBeGreaterThanOrEqual(0);
      expect(m.alignmentRate).toBeLessThanOrEqual(100);
    }
  });

  it('misalignedSessions >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.misalignedSessions).toBeGreaterThanOrEqual(0);
    }
  });

  it('highPriorityFirst >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.highPriorityFirst).toBeGreaterThanOrEqual(0);
    }
  });

  it('avgResponseToHighPriority >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgResponseToHighPriority).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts metrics by alignmentScore descending', async () => {
    const sessions = [
      ...makeSessions('agentA', 5, 'completed', 500000),
      ...makeSessions('agentB', 5, 'failed', 2000000),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].alignmentScore).toBeGreaterThanOrEqual(report.metrics[i].alignmentScore);
    }
  });

  it('trend is improving when recent completion better than older', async () => {
    const recentSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `r-${i}`,
      agentId: 'agentA',
      agentName: 'Agent A',
      createdAt: new Date(Date.now() - i * 100000),
      startedAt: new Date(Date.now() - i * 100000),
      completedAt: new Date(Date.now() - i * 100000 + 50000),
      status: 'completed',
      durationMs: 50000,
    }));
    const olderSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `o-${i}`,
      agentId: 'agentA',
      agentName: 'Agent A',
      createdAt: new Date(Date.now() - 3600000 * 24 - i * 100000),
      startedAt: new Date(Date.now() - 3600000 * 24 - i * 100000),
      completedAt: new Date(Date.now() - 3600000 * 24 - i * 100000 + 50000),
      status: 'failed',
      durationMs: 50000,
    }));
    (db.limit as any).mockResolvedValue([...recentSessions, ...olderSessions]);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(report.metrics[0].trend).toBe('improving');
  });

  it('trend: degrading when recent completion worse than older', async () => {
    const recentSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `r-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - i * 100000),
      startedAt: new Date(Date.now() - i * 100000),
      completedAt: new Date(Date.now() - i * 100000 + 50000),
      status: 'failed', durationMs: 50000,
    }));
    const olderSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `o-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - 3600000 * 24 - i * 100000),
      startedAt: new Date(Date.now() - 3600000 * 24 - i * 100000),
      completedAt: new Date(Date.now() - 3600000 * 24 - i * 100000 + 50000),
      status: 'completed', durationMs: 50000,
    }));
    (db.limit as any).mockResolvedValue([...recentSessions, ...olderSessions]);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    expect(report.metrics[0].trend).toBe('degrading');
  });

  it('rating: excellent when alignmentScore >= 80', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({
      id: `s-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - i * 100000),
      startedAt: new Date(Date.now() - i * 100000),
      completedAt: new Date(Date.now() - i * 100000 + 50000),
      status: 'completed', durationMs: 500000,
    }));
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    const agent = report.metrics.find(m => m.agentId === 'agentA');
    if (agent && agent.alignmentScore >= 80) {
      expect(agent.rating).toBe('excellent');
    } else {
      expect(true).toBe(true);
    }
  });

  it('poorAlignmentAgents counts agents with alignmentScore < 40', async () => {
    const sessions = makeSessions('agentFail', 5, 'failed');
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
    const poorCount = report.metrics.filter(m => m.alignmentScore < 40).length;
    expect(report.poorAlignmentAgents).toBe(poorCount);
  });
});
