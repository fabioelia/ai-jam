import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCommunicationOverheadAnalyzer } from '../agent-communication-overhead-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

const now = Date.now();

function makeSession(agentId: string, i: number, overrides: Record<string, any> = {}) {
  return {
    id: `session-${agentId}-${i}`,
    agentId,
    status: 'completed',
    createdAt: new Date(now - i * 60000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.select as any).mockReturnThis();
  (db.from as any).mockReturnThis();
  (db.orderBy as any).mockReturnThis();
  (db.limit as any).mockResolvedValue([]);
});

describe('analyzeAgentCommunicationOverheadAnalyzer', () => {
  it('empty sessions → empty metrics', async () => {
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgOverheadRatio).toBe(0);
    expect(report.highOverheadAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgOverheadRatio).toBe('number');
    expect(typeof report.highOverheadAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is ISO string', async () => {
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('communicationOverheadRatio >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    for (const m of report.metrics) {
      expect(m.communicationOverheadRatio).toBeGreaterThanOrEqual(0);
    }
  });

  it('messageCount >= 5', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].messageCount).toBeGreaterThanOrEqual(5);
  });

  it('avgResponseLatencyMs >= 200', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].avgResponseLatencyMs).toBeGreaterThanOrEqual(200);
  });

  it('coordinationCostPerTask >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].coordinationCostPerTask).toBeGreaterThanOrEqual(0);
  });

  it('overheadTrend is valid enum', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(['increasing', 'stable', 'decreasing']).toContain(report.metrics[0].overheadTrend);
  });

  it('highOverheadAgents counts agents with ratio > 0.5', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 5 }, (_, i) => makeSession('bad', i, { status: 'error' })),
      makeSession('good', 0),
      makeSession('good', 1),
      makeSession('good', 2),
    ]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    const expected = report.metrics.filter(m => m.communicationOverheadRatio > 0.5).length;
    expect(report.highOverheadAgents).toBe(expected);
  });

  it('fleetAvgOverheadRatio is average of all agents', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    const expected = Math.round(
      report.metrics.reduce((sum, m) => sum + m.communicationOverheadRatio, 0) / report.metrics.length * 1000
    ) / 1000;
    expect(report.fleetAvgOverheadRatio).toBe(expected);
  });

  it('multiple agents produce separate metrics', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
      makeSession('c', 0),
    ]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics).toHaveLength(3);
  });

  it('trend increasing when recent has more errors', async () => {
    const older = Array.from({ length: 10 }, (_, i) => makeSession('a', 20 - i));
    const recent = Array.from({ length: 10 }, (_, i) => makeSession('a', 9 - i, { status: 'error' }));
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].overheadTrend).toBe('increasing');
  });

  it('trend decreasing when recent has fewer errors', async () => {
    const older = Array.from({ length: 10 }, (_, i) => makeSession('a', 20 - i, { status: 'error' }));
    const recent = Array.from({ length: 10 }, (_, i) => makeSession('a', 9 - i));
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].overheadTrend).toBe('decreasing');
  });

  it('zero completed sessions produces coordinationCostPerTask=0 or >0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0, { status: 'error' })]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    expect(report.metrics[0].coordinationCostPerTask).toBeGreaterThanOrEqual(0);
  });

  it('metrics sorted by communicationOverheadRatio ascending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('high', 0, { status: 'error' }),
      makeSession('high', 1, { status: 'error' }),
      makeSession('high', 2, { status: 'error' }),
      makeSession('low', 0),
      makeSession('low', 1),
      makeSession('low', 2),
    ]);
    const report = await analyzeAgentCommunicationOverheadAnalyzer();
    const ratios = report.metrics.map(m => m.communicationOverheadRatio);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]);
    }
  });
});
