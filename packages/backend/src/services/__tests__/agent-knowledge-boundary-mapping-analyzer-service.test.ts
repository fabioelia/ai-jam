import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentKnowledgeBoundaryMappingAnalyzer } from '../agent-knowledge-boundary-mapping-analyzer-service.js';

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

describe('analyzeAgentKnowledgeBoundaryMappingAnalyzer', () => {
  it('empty sessions → empty metrics, scores=0', async () => {
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgBoundaryScore).toBe(0);
    expect(report.overconfidentAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgBoundaryScore).toBe('number');
    expect(typeof report.overconfidentAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('returns analysisTimestamp as ISO string', async () => {
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('boundaryScore is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1), makeSession('a', 2),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    for (const m of report.metrics) {
      expect(m.boundaryScore).toBeGreaterThanOrEqual(0);
      expect(m.boundaryScore).toBeLessThanOrEqual(100);
    }
  });

  it('silentFailureRate is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0, { status: 'error' }),
      makeSession('a', 1),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].silentFailureRate).toBeGreaterThanOrEqual(0);
    expect(report.metrics[0].silentFailureRate).toBeLessThanOrEqual(100);
  });

  it('boundaryRespectRate is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0, { status: 'cancelled' }),
      makeSession('a', 1),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].boundaryRespectRate).toBeGreaterThanOrEqual(0);
    expect(report.metrics[0].boundaryRespectRate).toBeLessThanOrEqual(100);
  });

  it('knowledgeCoverageScore is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].knowledgeCoverageScore).toBeGreaterThanOrEqual(0);
    expect(report.metrics[0].knowledgeCoverageScore).toBeLessThanOrEqual(100);
  });

  it('gapDensity >= 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].gapDensity).toBeGreaterThanOrEqual(0);
  });

  it('sorts metrics by boundaryScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('low', 0, { status: 'error' }),
      makeSession('low', 1, { status: 'error' }),
      makeSession('high', 0),
      makeSession('high', 1),
      makeSession('high', 2),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    const scores = report.metrics.map(m => m.boundaryScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('trend improving when recent better than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) =>
      makeSession('a', 20 - i, { status: 'error' })
    );
    const recent = Array.from({ length: 10 }, (_, i) => makeSession('a', 9 - i));
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].trend).toBe('improving');
  });

  it('trend degrading when recent worse than older', async () => {
    const older = Array.from({ length: 10 }, (_, i) => makeSession('a', 20 - i));
    const recent = Array.from({ length: 10 }, (_, i) =>
      makeSession('a', 9 - i, { status: 'error' })
    );
    (db.limit as any).mockResolvedValueOnce([...older, ...recent]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    expect(report.metrics[0].trend).toBe('degrading');
  });

  it('rating excellent when score >= 80', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession('a', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    const m = report.metrics[0];
    if (m.boundaryScore >= 80) expect(m.rating).toBe('excellent');
    else expect(['good', 'fair', 'poor']).toContain(m.rating);
  });

  it('overconfidentAgents counts agents with silentFailureRate > 30', async () => {
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => makeSession('bad', i, { status: 'error' })),
      makeSession('bad', 4, { status: 'completed' }),
      makeSession('good', 0),
      makeSession('good', 1),
      makeSession('good', 2),
    ];
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    const expected = report.metrics.filter(m => m.silentFailureRate > 30).length;
    expect(report.overconfidentAgents).toBe(expected);
  });

  it('fleetAvgBoundaryScore is average of all agent scores', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
    const expected = Math.round(
      report.metrics.reduce((sum, m) => sum + m.boundaryScore, 0) / report.metrics.length
    );
    expect(report.fleetAvgBoundaryScore).toBe(expected);
  });
});
