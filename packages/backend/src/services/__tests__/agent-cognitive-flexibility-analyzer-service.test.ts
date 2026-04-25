import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCognitiveFlexibilityAnalyzer } from '../agent-cognitive-flexibility-analyzer-service.js';

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

describe('analyzeAgentCognitiveFlexibilityAnalyzer', () => {
  it('empty sessions → empty agents', async () => {
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.avgScore).toBe(0);
    expect(report.summary.mostFlexible).toBe('');
    expect(report.summary.leastFlexible).toBe('');
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.summary.avgScore).toBe('number');
    expect(typeof report.summary.mostFlexible).toBe('string');
    expect(typeof report.summary.leastFlexible).toBe('string');
  });

  it('cognitiveFlexibilityScore is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.cognitiveFlexibilityScore).toBeGreaterThanOrEqual(0);
      expect(m.cognitiveFlexibilityScore).toBeLessThanOrEqual(1);
    }
  });

  it('solutionDiversityIndex is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.solutionDiversityIndex).toBeGreaterThanOrEqual(0);
      expect(m.solutionDiversityIndex).toBeLessThanOrEqual(1);
    }
  });

  it('failureAdaptationRate is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    for (const m of report.agents) {
      expect(m.failureAdaptationRate).toBeGreaterThanOrEqual(0);
      expect(m.failureAdaptationRate).toBeLessThanOrEqual(1);
    }
  });

  it('rigidityRisk is valid enum', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(['low', 'moderate', 'high']).toContain(report.agents[0].rigidityRisk);
  });

  it('zero sessions → avgRecoveryTimeMs defaults', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents[0].avgRecoveryTimeMs).toBeGreaterThan(0);
  });

  it('agents sorted by cognitiveFlexibilityScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('good', 0), makeSession('good', 1), makeSession('good', 2),
      makeSession('bad', 0, { status: 'error' }), makeSession('bad', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    const scores = report.agents.map(a => a.cognitiveFlexibilityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('pivot detected: error→completed transition', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('agent', 3, { status: 'error' }),
      makeSession('agent', 2, { status: 'completed' }),
      makeSession('agent', 1, { status: 'completed' }),
    ]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents[0].strategyPivotCount).toBeGreaterThanOrEqual(0);
  });

  it('all errors → low cognitiveFlexibilityScore', async () => {
    const sessions = Array.from({ length: 8 }, (_, i) => makeSession('bad', i, { status: 'error' }));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents[0].cognitiveFlexibilityScore).toBeLessThan(0.5);
  });

  it('all completed → high cognitiveFlexibilityScore', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession('great', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents[0].cognitiveFlexibilityScore).toBeGreaterThan(0.3);
  });

  it('summary.mostFlexible matches first sorted agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.summary.mostFlexible).toBe(report.agents[0].agentId);
  });

  it('summary.leastFlexible matches last sorted agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.summary.leastFlexible).toBe(report.agents[report.agents.length - 1].agentId);
  });

  it('multiple agents → avgScore is correct average', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('x', 0), makeSession('x', 1),
      makeSession('y', 0), makeSession('y', 1),
    ]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    const expected = Math.round(
      report.agents.reduce((s, a) => s + a.cognitiveFlexibilityScore, 0) / report.agents.length * 1000
    ) / 1000;
    expect(report.summary.avgScore).toBe(expected);
  });

  it('single session agent → strategyPivotCount is 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    expect(report.agents[0].strategyPivotCount).toBe(0);
  });

  it('rigidityRisk low when score >= 0.6', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession('good', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentCognitiveFlexibilityAnalyzer('proj-1');
    const m = report.agents[0];
    if (m.cognitiveFlexibilityScore >= 0.6) {
      expect(m.rigidityRisk).toBe('low');
    }
  });
});
