import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentToolSelectionAccuracy } from '../agent-tool-selection-accuracy-analyzer-service.js';

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

describe('analyzeAgentToolSelectionAccuracy', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgToolSelectionScore');
    expect(report).toHaveProperty('lowPrecisionAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgToolSelectionScore is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(report.fleetAvgToolSelectionScore).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgToolSelectionScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(report.fleetAvgToolSelectionScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgToolSelectionScore).toBeLessThanOrEqual(100);
  });

  it('optimalToolRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentToolSelectionAccuracy();
    for (const m of report.metrics) {
      expect(m.optimalToolRate).toBeGreaterThanOrEqual(0);
      expect(m.optimalToolRate).toBeLessThanOrEqual(100);
    }
  });

  it('unnecessaryToolCallRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentToolSelectionAccuracy();
    for (const m of report.metrics) {
      expect(m.unnecessaryToolCallRate).toBeGreaterThanOrEqual(0);
      expect(m.unnecessaryToolCallRate).toBeLessThanOrEqual(100);
    }
  });

  it('toolMismatchRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentToolSelectionAccuracy();
    for (const m of report.metrics) {
      expect(m.toolMismatchRate).toBeGreaterThanOrEqual(0);
      expect(m.toolMismatchRate).toBeLessThanOrEqual(100);
    }
  });

  it('totalToolCalls > 0', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentToolSelectionAccuracy();
    for (const m of report.metrics) {
      expect(m.totalToolCalls).toBeGreaterThan(0);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentToolSelectionAccuracy();
    const validTrends = ['improving', 'stable', 'degrading'];
    for (const m of report.metrics) {
      expect(validTrends).toContain(m.trend);
    }
  });

  it('precision correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentToolSelectionAccuracy();
    for (const m of report.metrics) {
      if (m.toolSelectionScore >= 80) expect(m.precision).toBe('expert');
      else if (m.toolSelectionScore >= 65) expect(m.precision).toBe('proficient');
      else if (m.toolSelectionScore >= 50) expect(m.precision).toBe('developing');
      else expect(m.precision).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentToolSelectionAccuracy();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by toolSelectionScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentToolSelectionAccuracy();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].toolSelectionScore).toBeGreaterThanOrEqual(report.metrics[i - 1].toolSelectionScore);
    }
  });

  it('lowPrecisionAgents counts agents with score < 50', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentToolSelectionAccuracy();
    const expected = report.metrics.filter(m => m.toolSelectionScore < 50).length;
    expect(report.lowPrecisionAgents).toBe(expected);
  });
});
