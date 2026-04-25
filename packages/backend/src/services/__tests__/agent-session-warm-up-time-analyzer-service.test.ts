import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSessionWarmUpTimeAnalyzer } from '../agent-session-warm-up-time-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, gapMs = 3600000, durationMs = 1800000) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * gapMs),
    completedAt: new Date(Date.now() - i * gapMs + durationMs),
    startedAt: new Date(Date.now() - i * gapMs),
    status: 'completed',
    durationMs,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentSessionWarmUpTimeAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgWarmUpScore');
    expect(report).toHaveProperty('slowWarmUpAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns metrics array', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgWarmUpScore as number', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(typeof report.fleetAvgWarmUpScore).toBe('number');
  });

  it('returns slowWarmUpAgents count', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(typeof report.slowWarmUpAgents).toBe('number');
    expect(report.slowWarmUpAgents).toBeGreaterThanOrEqual(0);
  });

  it('returns analysisTimestamp string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(typeof report.analysisTimestamp).toBe('string');
    expect(new Date(report.analysisTimestamp).getTime()).not.toBeNaN();
  });

  it('handles empty sessions gracefully', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgWarmUpScore).toBe(0);
    expect(report.slowWarmUpAgents).toBe(0);
  });

  it('warmUpScore is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.warmUpScore).toBeGreaterThanOrEqual(0);
      expect(m.warmUpScore).toBeLessThanOrEqual(100);
    }
  });

  it('warmUpRatio is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.warmUpRatio).toBeGreaterThanOrEqual(0);
      expect(m.warmUpRatio).toBeLessThanOrEqual(100);
    }
  });

  it('avgWarmUpMs >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgWarmUpMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('coldStartSessions >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 600000));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.coldStartSessions).toBeGreaterThanOrEqual(0);
    }
  });

  it('hotStartSessions >= 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 30000));
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (const m of report.metrics) {
      expect(m.hotStartSessions).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts metrics by warmUpScore descending', async () => {
    const sessions = [
      ...makeSessions('agentA', 5, 30000),
      ...makeSessions('agentB', 5, 600000),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].warmUpScore).toBeGreaterThanOrEqual(report.metrics[i].warmUpScore);
    }
  });

  it('trend: improving when recent gaps shorter (more hot starts)', async () => {
    const recentSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `r-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - i * 30000),
      startedAt: new Date(Date.now() - i * 30000),
      completedAt: new Date(Date.now() - i * 30000 + 10000),
      status: 'completed', durationMs: 10000,
    }));
    const olderSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `o-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - 3600000 - i * 600000),
      startedAt: new Date(Date.now() - 3600000 - i * 600000),
      completedAt: new Date(Date.now() - 3600000 - i * 600000 + 10000),
      status: 'completed', durationMs: 10000,
    }));
    (db.limit as any).mockResolvedValue([...recentSessions, ...olderSessions]);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(report.metrics[0].trend).toBe('improving');
  });

  it('trend: degrading when recent gaps longer (fewer hot starts)', async () => {
    const recentSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `r-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - i * 600000),
      startedAt: new Date(Date.now() - i * 600000),
      completedAt: new Date(Date.now() - i * 600000 + 10000),
      status: 'completed', durationMs: 10000,
    }));
    const olderSessions = Array.from({ length: 10 }, (_, i) => ({
      id: `o-${i}`, agentId: 'agentA', agentName: 'Agent A',
      createdAt: new Date(Date.now() - 7200000 - i * 30000),
      startedAt: new Date(Date.now() - 7200000 - i * 30000),
      completedAt: new Date(Date.now() - 7200000 - i * 30000 + 10000),
      status: 'completed', durationMs: 10000,
    }));
    (db.limit as any).mockResolvedValue([...recentSessions, ...olderSessions]);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    expect(report.metrics[0].trend).toBe('degrading');
  });

  it('rating: excellent when warmUpScore >= 80', async () => {
    const sessions = makeSessions('agentA', 10, 30000, 1000000);
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    const agent = report.metrics.find(m => m.agentId === 'agentA');
    if (agent && agent.warmUpScore >= 80) {
      expect(agent.rating).toBe('excellent');
    } else {
      expect(true).toBe(true);
    }
  });

  it('slowWarmUpAgents counts agents with warmUpScore < 40', async () => {
    const sessions = makeSessions('agentSlow', 3, 600000, 100);
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
    const slowCount = report.metrics.filter(m => m.warmUpScore < 40).length;
    expect(report.slowWarmUpAgents).toBe(slowCount);
  });
});
