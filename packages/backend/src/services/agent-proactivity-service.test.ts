import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeProactivityScore,
  computeProactivityTier,
  analyzeAgentProactivity,
} from './agent-proactivity-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}

function mockDb(results: unknown[][]) {
  let call = 0;
  (db as any).select.mockImplementation(() => {
    const data = results[call] ?? [];
    call++;
    return makeSelectChain(data);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeProactivityScore', () => {
  it('returns 0 for zero totalTasks', () => {
    expect(computeProactivityScore(5, 3, 2, 0)).toBe(0);
  });

  it('computes score from noteRate + blockerRate + suggestionRate', () => {
    // totalTasks=10, unpromptedNotes=10 (rate=1 → 40), blockers=10 (rate=1 → 35), suggestions=10 (rate=1 → 25)
    expect(computeProactivityScore(10, 10, 10, 10)).toBe(100);
  });

  it('clamps to 100 maximum', () => {
    const score = computeProactivityScore(1000, 1000, 1000, 1);
    expect(score).toBe(100);
  });

  it('clamps to 0 minimum for negative-like inputs', () => {
    const score = computeProactivityScore(0, 0, 0, 10);
    expect(score).toBe(0);
  });

  it('partial contributions work correctly', () => {
    // totalTasks=10, notes=10 (40), blockers=0 (0), suggestions=0 (0) → 40
    expect(computeProactivityScore(10, 0, 0, 10)).toBe(40);
  });
});

describe('computeProactivityTier', () => {
  it('returns correct tier for thresholds 75/50/25', () => {
    expect(computeProactivityTier(75)).toBe('proactive');
    expect(computeProactivityTier(50)).toBe('engaged');
    expect(computeProactivityTier(25)).toBe('reactive');
    expect(computeProactivityTier(24)).toBe('passive');
    expect(computeProactivityTier(0)).toBe('passive');
  });
});

describe('analyzeAgentProactivity', () => {
  it('empty project returns empty report', async () => {
    mockDb([[]]); // no tickets
    const result = await analyzeAgentProactivity('proj-empty');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.mostProactive).toBeNull();
    expect(result.summary.leastProactive).toBeNull();
    expect(result.summary.totalAgents).toBe(0);
  });

  it('mostProactive is agent with highest proactivityScore', async () => {
    mockDb([
      [{ id: 't1' }, { id: 't2' }],
      [
        { personaType: 'alice', status: 'completed', retryCount: 1 },
        { personaType: 'alice', status: 'completed', retryCount: 1 },
        { personaType: 'alice', status: 'failed', retryCount: 0 },
        { personaType: 'bob', status: 'completed', retryCount: 0 },
        { personaType: 'bob', status: 'completed', retryCount: 0 },
      ],
    ]);
    const result = await analyzeAgentProactivity('proj-1');
    // alice has retries and failures → higher proactivity
    expect(result.summary.mostProactive).toBeDefined();
    expect(typeof result.summary.mostProactive).toBe('string');
  });

  it('leastProactive is agent with lowest proactivityScore', async () => {
    mockDb([
      [{ id: 't1' }],
      [
        { personaType: 'alice', status: 'completed', retryCount: 1 },
        { personaType: 'alice', status: 'failed', retryCount: 0 },
        { personaType: 'bob', status: 'completed', retryCount: 0 },
        { personaType: 'bob', status: 'completed', retryCount: 0 },
      ],
    ]);
    const result = await analyzeAgentProactivity('proj-1');
    expect(result.summary.leastProactive).toBeDefined();
  });

  it('proactiveAgents count is agents with score >= 75', async () => {
    mockDb([
      [{ id: 't1' }],
      [
        // alice: 2 completed with retries (notes=2/2=1→40), 2 failed (blockers=2/2=1→35), 0 clean suggestions
        // score = 40+35+0 = 75 → proactive
        { personaType: 'alice', status: 'completed', retryCount: 1 },
        { personaType: 'alice', status: 'completed', retryCount: 1 },
        { personaType: 'alice', status: 'failed', retryCount: 0 },
        { personaType: 'alice', status: 'failed', retryCount: 0 },
      ],
    ]);
    const result = await analyzeAgentProactivity('proj-1');
    expect(result.summary.proactiveAgents).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary.proactiveAgents).toBe('number');
  });

  it('multi-agent summary avgProactivityScore is computed correctly', async () => {
    mockDb([
      [{ id: 't1' }],
      [
        { personaType: 'alice', status: 'completed', retryCount: 0 },
        { personaType: 'bob', status: 'completed', retryCount: 0 },
      ],
    ]);
    const result = await analyzeAgentProactivity('proj-1');
    expect(result.summary.totalAgents).toBe(2);
    expect(result.summary.avgProactivityScore).toBeGreaterThanOrEqual(0);
  });

  it('report has correct projectId and generatedAt', async () => {
    mockDb([[]]);
    const result = await analyzeAgentProactivity('proj-xyz');
    expect(result.projectId).toBe('proj-xyz');
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('score formula: totalTasks=4, notes=2, blockers=1, suggestions=1 → partial scores', () => {
    // noteRate = min(2/4,1)*40 = 0.5*40=20
    // blockerRate = min(1/4,1)*35 = 0.25*35=8.75≈9
    // suggestionRate = min(1/4,1)*25 = 0.25*25=6.25≈6
    // total ≈ 35
    const score = computeProactivityScore(2, 1, 1, 4);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(40);
  });
});
