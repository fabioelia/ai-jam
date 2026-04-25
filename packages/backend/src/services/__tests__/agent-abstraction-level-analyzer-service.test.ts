import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAbstractionLevelAnalyzer } from '../agent-abstraction-level-analyzer-service.js';

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

describe('analyzeAgentAbstractionLevelAnalyzer', () => {
  it('empty sessions → empty metrics, fleetAvgAgilityScore=0, balancedAgents=0', async () => {
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAgilityScore).toBe(0);
    expect(report.balancedAgents).toBe(0);
  });

  it('agent with 1 session excluded from metrics', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-solo', 1));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 3),
    ]);
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgAgilityScore).toBe('number');
    expect(typeof report.balancedAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by abstractionAgilityScore', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 10),
      ...makeSessions('agent-b', 10),
      ...makeSessions('agent-c', 10),
    ]);
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].abstractionAgilityScore).toBeLessThanOrEqual(report.metrics[i].abstractionAgilityScore);
    }
  });

  it('abstractionAgilityScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].abstractionAgilityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].abstractionAgilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('lowLevelProficiency in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].lowLevelProficiency).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].lowLevelProficiency).toBeLessThanOrEqual(100);
    }
  });

  it('highLevelProficiency in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].highLevelProficiency).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].highLevelProficiency).toBeLessThanOrEqual(100);
    }
  });

  it('levelSwitchSuccessRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].levelSwitchSuccessRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].levelSwitchSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('abstractionMismatchRate is non-negative number', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].abstractionMismatchRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('dominantLevel is one of low|mid|high|balanced', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    if (report.metrics.length > 0) {
      expect(['low', 'mid', 'high', 'balanced']).toContain(report.metrics[0].dominantLevel);
    }
  });

  it('rating: >=80=excellent, >=65=good, >=50=fair, else poor', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    for (const m of report.metrics) {
      if (m.abstractionAgilityScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.abstractionAgilityScore >= 65) expect(m.rating).toBe('good');
      else if (m.abstractionAgilityScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('balancedAgents counts agents with dominantLevel === balanced', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    const expected = report.metrics.filter(m => m.dominantLevel === 'balanced').length;
    expect(report.balancedAgents).toBe(expected);
  });

  it('fleetAvgAgilityScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentAbstractionLevelAnalyzer();
    expect(report.fleetAvgAgilityScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgAgilityScore).toBeLessThanOrEqual(100);
  });
});
