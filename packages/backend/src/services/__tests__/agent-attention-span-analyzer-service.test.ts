import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAttentionSpanAnalyzer } from '../agent-attention-span-analyzer-service.js';

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
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: i % 5 === 0 ? 'error' : 'completed',
    retryCount: i % 3 === 0 ? 1 : 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentAttentionSpanAnalyzer', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgFocusScore');
    expect(report).toHaveProperty('shortAttentionAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgFocusScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(report.fleetAvgFocusScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgFocusScore).toBeLessThanOrEqual(100);
  });

  it('shortAttentionAgents counts agents with focusScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    const expected = report.metrics.filter(m => m.focusScore < 50).length;
    expect(report.shortAttentionAgents).toBe(expected);
  });

  it('focusScore in 0-100 for all metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      expect(m.focusScore).toBeGreaterThanOrEqual(0);
      expect(m.focusScore).toBeLessThanOrEqual(100);
    }
  });

  it('avgSessionDurationMs is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgSessionDurationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('maxSessionDurationMs >= avgSessionDurationMs', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      expect(m.maxSessionDurationMs).toBeGreaterThanOrEqual(m.avgSessionDurationMs);
    }
  });

  it('contextSwitchRate is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextSwitchRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating excellent when score >= 80', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (const m of report.metrics) {
      if (m.focusScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.focusScore >= 60) expect(m.rating).toBe('good');
      else if (m.focusScore >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by focusScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].focusScore).toBeGreaterThanOrEqual(report.metrics[i].focusScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgFocusScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('totalSessions reflects session count', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentAttentionSpanAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].totalSessions).toBe(5);
    }
  });

  it('multiple agents each get own metric', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentAttentionSpanAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });
});
