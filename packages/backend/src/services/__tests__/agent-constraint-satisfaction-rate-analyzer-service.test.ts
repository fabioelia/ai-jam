import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentConstraintSatisfactionRate } from '../agent-constraint-satisfaction-rate-analyzer-service.js';

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

describe('analyzeAgentConstraintSatisfactionRate', () => {
  it('empty sessions → empty agents and zero summary', async () => {
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.satisfactionRate).toBe(0);
    expect(report.summary.mostCompliantAgent).toBe('');
    expect(report.summary.leastCompliantAgent).toBe('');
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.summary.satisfactionRate).toBe('number');
    expect(typeof report.summary.mostCompliantAgent).toBe('string');
    expect(typeof report.summary.violationBreakdown).toBe('object');
  });

  it('satisfactionRate is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1), makeSession('a', 2)]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    for (const m of report.agents) {
      expect(m.satisfactionRate).toBeGreaterThanOrEqual(0);
      expect(m.satisfactionRate).toBeLessThanOrEqual(100);
    }
  });

  it('all completed → satisfaction rate 100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1), makeSession('a', 2),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents[0].satisfactionRate).toBe(100);
  });

  it('all violations → satisfaction rate 0', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('bad', 0, { status: 'error' }),
      makeSession('bad', 1, { status: 'error' }),
      makeSession('bad', 2, { status: 'error' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents[0].satisfactionRate).toBe(0);
  });

  it('zero constraints → satisfactionRate 0', async () => {
    (db.limit as any).mockResolvedValueOnce([]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.summary.satisfactionRate).toBe(0);
  });

  it('single session → valid metric', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents[0].totalConstraints).toBe(4);
    expect(report.agents[0].satisfactionRate).toBe(100);
  });

  it('agents sorted by satisfactionRate descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('good', 0), makeSession('good', 1), makeSession('good', 2),
      makeSession('bad', 0, { status: 'error' }), makeSession('bad', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    const rates = report.agents.map(a => a.satisfactionRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
    }
  });

  it('summary.mostCompliantAgent matches first agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.summary.mostCompliantAgent).toBe(report.agents[0].agentId);
  });

  it('summary.leastCompliantAgent matches last agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.summary.leastCompliantAgent).toBe(report.agents[report.agents.length - 1].agentId);
  });

  it('violationBreakdown has format, scope, safety, requirements keys', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(typeof report.summary.violationBreakdown.format).toBe('number');
    expect(typeof report.summary.violationBreakdown.scope).toBe('number');
    expect(typeof report.summary.violationBreakdown.safety).toBe('number');
    expect(typeof report.summary.violationBreakdown.requirements).toBe('number');
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
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
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
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents[0].trend).toBe('declining');
  });

  it('trend: stable when halves equal', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 3), makeSession('a', 2),
      makeSession('a', 1), makeSession('a', 0),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents[0].trend).toBe('stable');
  });

  it('summary.satisfactionRate aggregate correct', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('x', 0), makeSession('x', 1),
      makeSession('y', 0, { status: 'error' }), makeSession('y', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.summary.satisfactionRate).toBe(50);
  });

  it('mixed constraint types → rates are numbers', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0),
      makeSession('a', 1, { status: 'error' }),
      makeSession('a', 2, { status: 'running' }),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(typeof report.agents[0].formatComplianceRate).toBe('number');
    expect(typeof report.agents[0].scopeAdherenceRate).toBe('number');
    expect(typeof report.agents[0].safetyComplianceRate).toBe('number');
    expect(typeof report.agents[0].requirementFulfillmentRate).toBe('number');
  });

  it('multiple agents have independent metrics', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentConstraintSatisfactionRate('proj-1');
    expect(report.agents).toHaveLength(2);
    expect(report.agents[0].agentId).not.toBe(report.agents[1].agentId);
  });
});
