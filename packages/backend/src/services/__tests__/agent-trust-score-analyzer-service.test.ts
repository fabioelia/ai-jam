import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTrustScoreAnalyzer } from '../agent-trust-score-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: 's1', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's2', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's3', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's4', agentId: 'agent-2', createdAt: new Date(), agentName: 'Bob' },
      { id: 's5', agentId: 'agent-2', createdAt: new Date(), agentName: 'Bob' },
    ]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentTrustScoreAnalyzer', () => {
  it('returns valid report shape with metrics/fleetAvgTrustScore/lowTrustAgents/analysisTimestamp', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgTrustScore');
    expect(report).toHaveProperty('lowTrustAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgTrustScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentTrustScoreAnalyzer();
    expect(report.fleetAvgTrustScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgTrustScore).toBeLessThanOrEqual(100);
  });

  it('lowTrustAgents counts agents with trustScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentTrustScoreAnalyzer();
    const expected = report.metrics.filter(m => m.trustScore < 50).length;
    expect(report.lowTrustAgents).toBe(expected);
  });

  it('reliabilityRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.reliabilityRate).toBeGreaterThanOrEqual(0);
      expect(m.reliabilityRate).toBeLessThanOrEqual(100);
    }
  });

  it('consistencyScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(m.consistencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('promiseKeptRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.promiseKeptRate).toBeGreaterThanOrEqual(0);
      expect(m.promiseKeptRate).toBeLessThanOrEqual(100);
    }
  });

  it('errorFrequency is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      expect(m.errorFrequency).toBeGreaterThanOrEqual(0);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating correct for score bands (>=80=excellent, >=65=good, >=50=fair, else poor)', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (const m of report.metrics) {
      if (m.trustScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.trustScore >= 65) expect(m.rating).toBe('good');
      else if (m.trustScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentTrustScoreAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by trustScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessions('a2', 4),
      ...makeSessions('a3', 4),
    ]);
    const report = await analyzeAgentTrustScoreAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].trustScore).toBeLessThanOrEqual(report.metrics[i].trustScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentTrustScoreAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgTrustScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentTrustScoreAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });
});
