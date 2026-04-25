import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTemporalConsistencyAnalyzer } from '../agent-temporal-consistency-analyzer-service.js';

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
    id: `session-${agentId}-${i}`,
    agentId,
    createdAt: new Date(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.select as any).mockReturnThis();
  (db.from as any).mockReturnThis();
  (db.orderBy as any).mockReturnThis();
  (db.limit as any).mockResolvedValue([]);
});

describe('analyzeAgentTemporalConsistencyAnalyzer', () => {
  it('empty sessions → empty metrics, fleetAvgConsistencyScore=0, unstableAgents=0', async () => {
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgConsistencyScore).toBe(0);
    expect(report.unstableAgents).toBe(0);
  });

  it('agent with 1 session excluded from metrics', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-solo', 1));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 3),
    ]);
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgConsistencyScore).toBe('number');
    expect(typeof report.unstableAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by temporalConsistencyScore', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 10),
      ...makeSessions('agent-b', 10),
      ...makeSessions('agent-c', 10),
    ]);
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].temporalConsistencyScore).toBeLessThanOrEqual(report.metrics[i].temporalConsistencyScore);
    }
  });

  it('temporalConsistencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].temporalConsistencyScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].temporalConsistencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('shortTermConsistency in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].shortTermConsistency).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].shortTermConsistency).toBeLessThanOrEqual(100);
    }
  });

  it('longTermConsistency in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].longTermConsistency).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].longTermConsistency).toBeLessThanOrEqual(100);
    }
  });

  it('stabilityIndex in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].stabilityIndex).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].stabilityIndex).toBeLessThanOrEqual(100);
    }
  });

  it('performanceDrift is a number (can be negative)', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(typeof report.metrics[0].performanceDrift).toBe('number');
    }
  });

  it('trend is one of improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'degrading']).toContain(report.metrics[0].trend);
    }
  });

  it('rating: >=80=excellent, >=65=good, >=50=fair, else poor', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    for (const m of report.metrics) {
      if (m.temporalConsistencyScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.temporalConsistencyScore >= 65) expect(m.rating).toBe('good');
      else if (m.temporalConsistencyScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('unstableAgents counts agents with temporalConsistencyScore < 50', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    const expected = report.metrics.filter(m => m.temporalConsistencyScore < 50).length;
    expect(report.unstableAgents).toBe(expected);
  });

  it('fleetAvgConsistencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentTemporalConsistencyAnalyzer();
    expect(report.fleetAvgConsistencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgConsistencyScore).toBeLessThanOrEqual(100);
  });
});
