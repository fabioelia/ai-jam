import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentReasoningChainDepth } from '../agent-reasoning-chain-depth-analyzer-service.js';

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

describe('analyzeAgentReasoningChainDepth', () => {
  it('empty sessions → empty metrics, fleetAvgChainDepth=0, optimalAgents=0', async () => {
    const report = await analyzeAgentReasoningChainDepth();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgChainDepth).toBe(0);
    expect(report.optimalAgents).toBe(0);
  });

  it('agent with 1 session excluded from metrics', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-solo', 1));
    const report = await analyzeAgentReasoningChainDepth();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 3),
    ]);
    const report = await analyzeAgentReasoningChainDepth();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgChainDepth).toBe('number');
    expect(typeof report.optimalAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentReasoningChainDepth();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by optimalRangeRate', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 10),
      ...makeSessions('agent-b', 10),
      ...makeSessions('agent-c', 10),
    ]);
    const report = await analyzeAgentReasoningChainDepth();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].optimalRangeRate).toBeGreaterThanOrEqual(report.metrics[i].optimalRangeRate);
    }
  });

  it('avgChainDepth is positive number', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].avgChainDepth).toBeGreaterThan(0);
    }
  });

  it('maxChainDepth >= minChainDepth', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].maxChainDepth).toBeGreaterThanOrEqual(report.metrics[0].minChainDepth);
    }
  });

  it('optimalRangeRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].optimalRangeRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].optimalRangeRate).toBeLessThanOrEqual(100);
    }
  });

  it('overReasoningRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].overReasoningRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].overReasoningRate).toBeLessThanOrEqual(100);
    }
  });

  it('underReasoningRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].underReasoningRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].underReasoningRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of increasing|stable|decreasing', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(['increasing', 'stable', 'decreasing']).toContain(report.metrics[0].trend);
    }
  });

  it('rating is one of optimal|adequate|shallow|excessive', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      expect(['optimal', 'adequate', 'shallow', 'excessive']).toContain(report.metrics[0].rating);
    }
  });

  it('optimalAgents counts agents with rating optimal', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentReasoningChainDepth();
    const expectedOptimal = report.metrics.filter(m => m.rating === 'optimal').length;
    expect(report.optimalAgents).toBe(expectedOptimal);
  });

  it('fleetAvgChainDepth is average of all agent avgChainDepth values', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentReasoningChainDepth();
    if (report.metrics.length > 0) {
      const expected = Math.round(
        (report.metrics.reduce((s, m) => s + m.avgChainDepth, 0) / report.metrics.length) * 10
      ) / 10;
      expect(report.fleetAvgChainDepth).toBe(expected);
    }
  });
});
