import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentErrorPropagation } from '../agent-error-propagation-analyzer-service.js';

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

describe('analyzeAgentErrorPropagation', () => {
  it('empty sessions → empty metrics, fleetAvgPropagationRate=0, highRiskAgents=0', async () => {
    const report = await analyzeAgentErrorPropagation();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgPropagationRate).toBe(0);
    expect(report.highRiskAgents).toBe(0);
  });

  it('agent with 1 session excluded from metrics', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-solo', 1));
    const report = await analyzeAgentErrorPropagation();
    expect(report.metrics).toHaveLength(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 3),
    ]);
    const report = await analyzeAgentErrorPropagation();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgPropagationRate).toBe('number');
    expect(typeof report.highRiskAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is valid ISO date', async () => {
    const report = await analyzeAgentErrorPropagation();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by errorPropagationRate (best first)', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 10),
      ...makeSessions('agent-b', 10),
      ...makeSessions('agent-c', 10),
    ]);
    const report = await analyzeAgentErrorPropagation();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].errorPropagationRate).toBeLessThanOrEqual(report.metrics[i].errorPropagationRate);
    }
  });

  it('errorPropagationRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].errorPropagationRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].errorPropagationRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgCascadeLength is positive number', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].avgCascadeLength).toBeGreaterThan(0);
    }
  });

  it('selfCorrectionRate >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].selfCorrectionRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('criticalCascades >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].criticalCascades).toBeGreaterThanOrEqual(0);
    }
  });

  it('containmentSpeed is positive number', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].containmentSpeed).toBeGreaterThan(0);
    }
  });

  it('trend is one of improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValueOnce(makeSessions('agent-a', 5));
    const report = await analyzeAgentErrorPropagation();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'degrading']).toContain(report.metrics[0].trend);
    }
  });

  it('rating: <15=excellent, <30=good, <50=fair, >=50=poor', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentErrorPropagation();
    for (const m of report.metrics) {
      if (m.errorPropagationRate < 15) expect(m.rating).toBe('excellent');
      else if (m.errorPropagationRate < 30) expect(m.rating).toBe('good');
      else if (m.errorPropagationRate < 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('highRiskAgents counts agents with errorPropagationRate > 40', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentErrorPropagation();
    const expected = report.metrics.filter(m => m.errorPropagationRate > 40).length;
    expect(report.highRiskAgents).toBe(expected);
  });

  it('fleetAvgPropagationRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentErrorPropagation();
    expect(report.fleetAvgPropagationRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgPropagationRate).toBeLessThanOrEqual(100);
  });
});
