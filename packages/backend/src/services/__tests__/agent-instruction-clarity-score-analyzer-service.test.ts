import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionClarityScore } from '../agent-instruction-clarity-score-analyzer-service.js';

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

describe('analyzeAgentInstructionClarityScore', () => {
  it('empty sessions → empty agents and zero summary', async () => {
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.clarityScore).toBe(0);
    expect(report.summary.highestClarityAgent).toBe('');
    expect(report.summary.lowestClarityAgent).toBe('');
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.summary.clarityScore).toBe('number');
    expect(typeof report.summary.highestClarityAgent).toBe('string');
    expect(typeof report.summary.lowestClarityAgent).toBe('string');
  });

  it('clarityScore is 0-100', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    for (const m of report.agents) {
      expect(m.clarityScore).toBeGreaterThanOrEqual(0);
      expect(m.clarityScore).toBeLessThanOrEqual(100);
    }
  });

  it('all completed → clarity score 100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1), makeSession('a', 2),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].clarityScore).toBe(100);
    expect(report.agents[0].clearExecutionRate).toBe(100);
  });

  it('all errors → clarity score 0', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('bad', 0, { status: 'error' }),
      makeSession('bad', 1, { status: 'error' }),
      makeSession('bad', 2, { status: 'error' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].clarityScore).toBe(0);
    expect(report.agents[0].misinterpretationRate).toBe(100);
  });

  it('all ambiguous (running) → ambiguityRate 100', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('amb', 0, { status: 'running' }),
      makeSession('amb', 1, { status: 'running' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].ambiguityRate).toBe(100);
    expect(report.agents[0].clarityScore).toBe(0);
  });

  it('single instruction → valid metric', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('solo', 0)]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].totalInstructions).toBe(1);
    expect(report.agents[0].clarityScore).toBe(100);
  });

  it('agents sorted by clarityScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('good', 0), makeSession('good', 1), makeSession('good', 2),
      makeSession('bad', 0, { status: 'error' }), makeSession('bad', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    const scores = report.agents.map(a => a.clarityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('summary.highestClarityAgent matches first agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.summary.highestClarityAgent).toBe(report.agents[0].agentId);
  });

  it('summary.lowestClarityAgent matches last agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0, { status: 'error' }), makeSession('b', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.summary.lowestClarityAgent).toBe(report.agents[report.agents.length - 1].agentId);
  });

  it('rates sum to 100 for single agent', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0),
      makeSession('a', 1, { status: 'error' }),
      makeSession('a', 2, { status: 'running' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    const m = report.agents[0];
    const sum = m.clearExecutionRate + m.misinterpretationRate + m.ambiguityRate + m.clarificationRequestRate;
    expect(Math.round(sum)).toBe(100);
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
    const report = await analyzeAgentInstructionClarityScore('proj-1');
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
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].trend).toBe('declining');
  });

  it('trend: stable when halves equal', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 3), makeSession('a', 2),
      makeSession('a', 1), makeSession('a', 0),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents[0].trend).toBe('stable');
  });

  it('summary.clarityScore is aggregate correct', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('x', 0), makeSession('x', 1),
      makeSession('y', 0, { status: 'error' }), makeSession('y', 1, { status: 'error' }),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.summary.clarityScore).toBe(50);
  });

  it('multiple agents have independent metrics', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentInstructionClarityScore('proj-1');
    expect(report.agents).toHaveLength(2);
    expect(report.agents[0].agentId).not.toBe(report.agents[1].agentId);
  });
});
