import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentHallucinationRateAnalyzer } from '../agent-hallucination-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, errorRate = 0.2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: Math.random() < errorRate ? 'error' : 'completed',
    retryCount: Math.random() < 0.3 ? 1 : 0,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentHallucinationRateAnalyzer', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgReliabilityScore');
    expect(report).toHaveProperty('highRiskAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgReliabilityScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(report.fleetAvgReliabilityScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgReliabilityScore).toBeLessThanOrEqual(100);
  });

  it('highRiskAgents counts agents with reliabilityScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    const expected = report.metrics.filter(m => m.reliabilityScore < 50).length;
    expect(report.highRiskAgents).toBe(expected);
  });

  it('reliabilityScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(m.reliabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('estimatedHallucinationRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.estimatedHallucinationRate).toBeGreaterThanOrEqual(0);
      expect(m.estimatedHallucinationRate).toBeLessThanOrEqual(100);
    }
  });

  it('contextAdherenceScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextAdherenceScore).toBeGreaterThanOrEqual(0);
      expect(m.contextAdherenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('correctionFrequency is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.correctionFrequency).toBeGreaterThanOrEqual(0);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (const m of report.metrics) {
      if (m.reliabilityScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.reliabilityScore >= 60) expect(m.rating).toBe('good');
      else if (m.reliabilityScore >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by reliabilityScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].reliabilityScore).toBeGreaterThanOrEqual(report.metrics[i].reliabilityScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgReliabilityScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue([{ id: 's1', agentId: 'solo', createdAt: new Date(), status: 'completed', retryCount: 0 }]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('multiple agents each get own metric', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentHallucinationRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });
});
