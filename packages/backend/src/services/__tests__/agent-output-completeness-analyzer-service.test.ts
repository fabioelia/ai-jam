import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentOutputCompletenessAnalyzer } from '../agent-output-completeness-analyzer-service.js';

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
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 86400000),
    completedAt: new Date(Date.now() - i * 86400000 + 3600000),
    startedAt: new Date(Date.now() - i * 86400000),
    status: 'completed',
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentOutputCompletenessAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgCompletenessScore');
    expect(report).toHaveProperty('incompleteAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    expect(report.metrics).toEqual([]);
    expect(report.fleetAvgCompletenessScore).toBe(0);
    expect(report.incompleteAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('loner', 1));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgCompletenessScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    expect(report.fleetAvgCompletenessScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCompletenessScore).toBeLessThanOrEqual(100);
  });

  it('incompleteAgents counts agents with completenessScore < 60', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('b1', 3), ...makeSessions('b2', 3)]);
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    const expected = report.metrics.filter(m => m.completenessScore < 60).length;
    expect(report.incompleteAgents).toBe(expected);
  });

  it('fullCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c1', 4));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.fullCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.fullCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('partialCompletionRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c2', 4));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.partialCompletionRate).toBeGreaterThanOrEqual(0);
      expect(m.partialCompletionRate).toBeLessThanOrEqual(100);
    }
  });

  it('abandonmentRate is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c3', 4));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.abandonmentRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('avgOutputCoverage in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('d1', 4));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgOutputCoverage).toBeGreaterThanOrEqual(0);
      expect(m.avgOutputCoverage).toBeLessThanOrEqual(100);
    }
  });

  it('completionTrend is one of valid values', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('d2', 4));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'declining']).toContain(m.completionTrend);
    }
  });

  it('rating is correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('e1', 3), ...makeSessions('e2', 3)]);
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (const m of report.metrics) {
      if (m.completenessScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.completenessScore >= 65) expect(m.rating).toBe('good');
      else if (m.completenessScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('f1', 3));
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by completenessScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('g1', 3), ...makeSessions('g2', 3), ...makeSessions('g3', 3)]);
    const report = await analyzeAgentOutputCompletenessAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].completenessScore).toBeGreaterThanOrEqual(report.metrics[i - 1].completenessScore);
    }
  });
});
