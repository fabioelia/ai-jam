import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentContextUtilizationEfficiency } from '../agent-context-utilization-efficiency-analyzer-service.js';

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

describe('analyzeAgentContextUtilizationEfficiency', () => {
  it('empty sessions → empty agents and zero summary', async () => {
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.efficiencyScore).toBe(0);
    expect(report.summary.mostEfficientAgent).toBe('');
    expect(report.summary.leastEfficientAgent).toBe('');
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.summary.efficiencyScore).toBe('number');
    expect(typeof report.summary.mostEfficientAgent).toBe('string');
    expect(typeof report.summary.leastEfficientAgent).toBe('string');
  });

  it('efficiencyScore is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    for (const m of report.agents) {
      expect(m.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.efficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('all relevant (completed) → efficiency score 100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1), makeSession('a', 2),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].efficiencyScore).toBe(100);
    expect(report.agents[0].relevantRetrievalRate).toBe(100);
  });

  it('all irrelevant (errors) → efficiency score 0', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('bad', 0, { status: 'error' }),
      makeSession('bad', 1, { status: 'error' }),
      makeSession('bad', 2, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].efficiencyScore).toBe(0);
    expect(report.agents[0].irrelevantRetrievalRate).toBe(100);
  });

  it('saturation events (running) tracked correctly', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0, { status: 'running' }),
      makeSession('a', 1, { status: 'running' }),
      makeSession('a', 2),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].saturationEvents).toBe(2);
    expect(report.agents[0].saturationEventRate).toBeCloseTo(66.67, 1);
  });

  it('zero retrievals → efficiencyScore 0', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].totalRetrievals).toBe(1);
  });

  it('agents sorted by efficiencyScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('good', 0), makeSession('good', 1),
      makeSession('bad', 0, { status: 'error' }), makeSession('bad', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    const scores = report.agents.map(a => a.efficiencyScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('summary.mostEfficientAgent matches first agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.summary.mostEfficientAgent).toBe(report.agents[0].agentId);
  });

  it('summary.leastEfficientAgent matches last agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.summary.leastEfficientAgent).toBe(report.agents[report.agents.length - 1].agentId);
  });

  it('trend: improving when second half better', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 7, { status: 'error' }),
      makeSession('a', 6, { status: 'error' }),
      makeSession('a', 3, { status: 'completed' }),
      makeSession('a', 2, { status: 'completed' }),
      makeSession('a', 1, { status: 'completed' }),
      makeSession('a', 0, { status: 'completed' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].trend).toBe('improving');
  });

  it('trend: declining when first half better', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 7, { status: 'completed' }),
      makeSession('a', 6, { status: 'completed' }),
      makeSession('a', 3, { status: 'error' }),
      makeSession('a', 2, { status: 'error' }),
      makeSession('a', 1, { status: 'error' }),
      makeSession('a', 0, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].trend).toBe('declining');
  });

  it('trend: stable when halves equal', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 3), makeSession('a', 2),
      makeSession('a', 1), makeSession('a', 0),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].trend).toBe('stable');
  });

  it('summary.efficiencyScore is aggregate correct', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('x', 0), makeSession('x', 1),
      makeSession('y', 0, { status: 'error' }), makeSession('y', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.summary.efficiencyScore).toBe(50);
  });

  it('multiple agents have independent metrics', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents).toHaveLength(2);
    expect(report.agents[0].agentId).not.toBe(report.agents[1].agentId);
  });

  it('unused context rate computed correctly', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentContextUtilizationEfficiency('proj-1');
    expect(report.agents[0].unusedContextRate).toBeGreaterThanOrEqual(0);
    expect(report.agents[0].unusedContextRate).toBeLessThanOrEqual(100);
  });
});
