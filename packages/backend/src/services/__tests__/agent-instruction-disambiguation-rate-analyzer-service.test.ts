import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionDisambiguationRateAnalyzer } from '../agent-instruction-disambiguation-rate-analyzer-service.js';

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

describe('analyzeAgentInstructionDisambiguationRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgDisambiguationScore');
    expect(report).toHaveProperty('highClarificationAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    expect(report.metrics).toEqual([]);
    expect(report.fleetAvgDisambiguationScore).toBe(0);
    expect(report.highClarificationAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('loner', 1));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgDisambiguationScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    expect(report.fleetAvgDisambiguationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgDisambiguationScore).toBeLessThanOrEqual(100);
  });

  it('highClarificationAgents counts agents with clarificationRequestRate > 30', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('b1', 3), ...makeSessions('b2', 3)]);
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    const expected = report.metrics.filter(m => m.clarificationRequestRate > 30).length;
    expect(report.highClarificationAgents).toBe(expected);
  });

  it('selfDisambiguationRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c1', 4));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.selfDisambiguationRate).toBeGreaterThanOrEqual(0);
      expect(m.selfDisambiguationRate).toBeLessThanOrEqual(100);
    }
  });

  it('clarificationRequestRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c2', 4));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.clarificationRequestRate).toBeGreaterThanOrEqual(0);
      expect(m.clarificationRequestRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgResolutionTime is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('c3', 4));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgResolutionTime).toBeGreaterThan(0);
    }
  });

  it('firstPassSuccessRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('d1', 4));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.firstPassSuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.firstPassSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('clarityAdaptation is one of valid values', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('d2', 4));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      expect(['high', 'medium', 'low']).toContain(m.clarityAdaptation);
    }
  });

  it('rating is correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('e1', 3), ...makeSessions('e2', 3)]);
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (const m of report.metrics) {
      if (m.disambiguationScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.disambiguationScore >= 65) expect(m.rating).toBe('good');
      else if (m.disambiguationScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('f1', 3));
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by disambiguationScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('g1', 3), ...makeSessions('g2', 3), ...makeSessions('g3', 3)]);
    const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].disambiguationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].disambiguationScore);
    }
  });
});
