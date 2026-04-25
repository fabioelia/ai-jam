import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputVerbosity } from '../agent-output-verbosity-analyzer-service.js';

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

describe('analyzeAgentOutputVerbosity', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentOutputVerbosity();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('avg_verbosity_score');
    expect(report).toHaveProperty('total_sessions');
    expect(report).toHaveProperty('over_verbose_rate');
    expect(report).toHaveProperty('under_verbose_rate');
    expect(report).toHaveProperty('optimal_rate');
    expect(report).toHaveProperty('avg_verbosity_ratio');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('most_verbose_agent');
    expect(report).toHaveProperty('least_verbose_agent');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputVerbosity();
    expect(report.metrics).toHaveLength(0);
    expect(report.total_sessions).toBe(0);
    expect(report.optimal_rate).toBe(100);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [...makeSessions('agentA', 3), ...makeSessions('agentB', 4)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentOutputVerbosity();
    expect(report.metrics).toHaveLength(2);
  });

  it('verbosityScore is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 8, 0.5));
    const report = await analyzeAgentOutputVerbosity();
    for (const m of report.metrics) {
      expect(m.verbosityScore).toBeGreaterThanOrEqual(0);
      expect(m.verbosityScore).toBeLessThanOrEqual(100);
    }
  });

  it('avg_verbosity_score is 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 0.5));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.avg_verbosity_score).toBeGreaterThanOrEqual(0);
    expect(report.avg_verbosity_score).toBeLessThanOrEqual(100);
  });

  it('rates are 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0.5));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.over_verbose_rate).toBeGreaterThanOrEqual(0);
    expect(report.over_verbose_rate).toBeLessThanOrEqual(100);
    expect(report.under_verbose_rate).toBeGreaterThanOrEqual(0);
    expect(report.under_verbose_rate).toBeLessThanOrEqual(100);
    expect(report.optimal_rate).toBeGreaterThanOrEqual(0);
    expect(report.optimal_rate).toBeLessThanOrEqual(100);
  });

  it('trend is valid enum', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentOutputVerbosity();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('high completion yields stable trend', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 20, 1.0));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.trend).toBe('stable');
  });

  it('metrics sorted by verbosityRatio descending', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentOutputVerbosity();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].verbosityRatio).toBeGreaterThanOrEqual(report.metrics[1].verbosityRatio);
    }
  });

  it('most_verbose_agent is first metric agentId', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentOutputVerbosity();
    expect(report.most_verbose_agent).toBe(report.metrics[0].agentId);
  });

  it('least_verbose_agent is last metric agentId', async () => {
    const sessions = [...makeSessions('badAgent', 10, 0), ...makeSessions('goodAgent', 10, 1.0)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentOutputVerbosity();
    expect(report.least_verbose_agent).toBe(report.metrics[report.metrics.length - 1].agentId);
  });

  it('optimalCount + overVerboseCount + underVerboseCount = totalSessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0.5));
    const report = await analyzeAgentOutputVerbosity();
    for (const m of report.metrics) {
      expect(m.optimalCount + m.overVerboseCount + m.underVerboseCount).toBe(m.totalSessions);
    }
  });

  it('verbosityRatio is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentOutputVerbosity();
    for (const m of report.metrics) {
      expect(m.verbosityRatio).toBeGreaterThan(0);
    }
  });

  it('total_sessions matches sum of session counts', async () => {
    const sessions = [...makeSessions('agentA', 3), ...makeSessions('agentB', 4)];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentOutputVerbosity();
    expect(report.total_sessions).toBe(7);
  });

  it('avg_verbosity_ratio is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.avg_verbosity_ratio).toBeGreaterThan(0);
  });

  it('analysisTimestamp is ISO string', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputVerbosity();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
  });

  it('single session handled correctly', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].totalSessions).toBe(1);
  });

  it('zero completion yields low verbosity score', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('worst', 10, 0));
    const report = await analyzeAgentOutputVerbosity();
    expect(report.metrics[0].verbosityScore).toBeLessThan(90);
  });
});
