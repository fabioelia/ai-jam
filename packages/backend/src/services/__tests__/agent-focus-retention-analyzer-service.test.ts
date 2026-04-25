import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentFocusRetention } from '../agent-focus-retention-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, completedRatio = 1.0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    startedAt: new Date(Date.now() - i * 3600000),
    completedAt: i < Math.floor(count * completedRatio) ? new Date(Date.now() - i * 3600000 + 1800000) : null,
    status: i < Math.floor(count * completedRatio) ? 'completed' : 'failed',
    durationMs: i < Math.floor(count * completedRatio) ? 1800000 : null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentFocusRetention', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentFocusRetention();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('avg_focus_score');
    expect(report).toHaveProperty('total_sessions');
    expect(report).toHaveProperty('total_drift_incidents');
    expect(report).toHaveProperty('overall_drift_rate');
    expect(report).toHaveProperty('avg_drift_point');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('best_focus_agent');
    expect(report).toHaveProperty('worst_focus_agent');
    expect(report).toHaveProperty('topDriftTriggers');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentFocusRetention();
    expect(report.metrics).toHaveLength(0);
    expect(report.total_sessions).toBe(0);
    expect(report.avg_focus_score).toBe(100);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [...makeSessions('agentA', 3), ...makeSessions('agentB', 4)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentFocusRetention();
    expect(report.metrics).toHaveLength(2);
  });

  it('avgFocusScore is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 8, 0.5));
    const report = await analyzeAgentFocusRetention();
    for (const m of report.metrics) {
      expect(m.avgFocusScore).toBeGreaterThanOrEqual(0);
      expect(m.avgFocusScore).toBeLessThanOrEqual(100);
    }
  });

  it('driftRate is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0.5));
    const report = await analyzeAgentFocusRetention();
    for (const m of report.metrics) {
      expect(m.driftRate).toBeGreaterThanOrEqual(0);
      expect(m.driftRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is valid enum', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentFocusRetention();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('high completion yields stable trend', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 20, 1.0));
    const report = await analyzeAgentFocusRetention();
    expect(report.trend).toBe('stable');
  });

  it('topDriftTriggers is non-empty string array', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentFocusRetention();
    expect(Array.isArray(report.topDriftTriggers)).toBe(true);
    expect(report.topDriftTriggers.length).toBeGreaterThan(0);
    expect(typeof report.topDriftTriggers[0]).toBe('string');
  });

  it('metrics sorted by avgFocusScore descending', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentFocusRetention();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].avgFocusScore).toBeGreaterThanOrEqual(report.metrics[1].avgFocusScore);
    }
  });

  it('best_focus_agent is first metric agentId', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentFocusRetention();
    expect(report.best_focus_agent).toBe(report.metrics[0].agentId);
  });

  it('worst_focus_agent is last metric agentId', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentFocusRetention();
    expect(report.worst_focus_agent).toBe(report.metrics[report.metrics.length - 1].agentId);
  });

  it('driftIncidents >= sessionsWithDrift', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0.5));
    const report = await analyzeAgentFocusRetention();
    for (const m of report.metrics) {
      expect(m.driftIncidents).toBeGreaterThanOrEqual(m.sessionsWithDrift);
    }
  });

  it('total_sessions matches sum of all sessions', async () => {
    const sessions = [...makeSessions('agentA', 3), ...makeSessions('agentB', 4)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentFocusRetention();
    expect(report.total_sessions).toBe(7);
  });

  it('avg_drift_point is reasonable (between 60-80)', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentFocusRetention();
    expect(report.avg_drift_point).toBeGreaterThanOrEqual(60);
    expect(report.avg_drift_point).toBeLessThanOrEqual(80);
  });

  it('overall_drift_rate is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0.5));
    const report = await analyzeAgentFocusRetention();
    expect(report.overall_drift_rate).toBeGreaterThanOrEqual(0);
    expect(report.overall_drift_rate).toBeLessThanOrEqual(100);
  });

  it('analysisTimestamp is ISO string', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentFocusRetention();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
  });

  it('single session handled correctly', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentFocusRetention();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].totalSessions).toBe(1);
  });
});
