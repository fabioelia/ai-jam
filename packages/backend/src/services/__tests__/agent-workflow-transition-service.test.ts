import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeTransitionEfficiencyScore,
  computeEfficiencyTier,
  analyzeAgentWorkflowTransitions,
} from '../agent-workflow-transition-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

import { db } from '../../db/connection.js';

describe('computeTransitionEfficiencyScore', () => {
  it('returns 0 when totalTransitions is 0', () => {
    expect(computeTransitionEfficiencyScore(10, 5, 0)).toBe(0);
  });

  it('penalizes stalled tickets', () => {
    const noStall = computeTransitionEfficiencyScore(10, 0, 10);
    const withStall = computeTransitionEfficiencyScore(10, 5, 10);
    expect(withStall).toBeLessThan(noStall);
  });

  it('clamps to [0, 100]', () => {
    // Very fast transitions, no stalls
    expect(computeTransitionEfficiencyScore(0, 0, 1)).toBeLessThanOrEqual(100);
    expect(computeTransitionEfficiencyScore(0, 0, 1)).toBeGreaterThanOrEqual(0);
    // Very slow transitions with many stalls
    expect(computeTransitionEfficiencyScore(1000, 1000, 1)).toBe(0);
  });
});

describe('computeEfficiencyTier', () => {
  it('returns correct tier for all 4 boundaries', () => {
    expect(computeEfficiencyTier(75)).toBe('fluid');
    expect(computeEfficiencyTier(100)).toBe('fluid');
    expect(computeEfficiencyTier(74)).toBe('steady');
    expect(computeEfficiencyTier(50)).toBe('steady');
    expect(computeEfficiencyTier(49)).toBe('sluggish');
    expect(computeEfficiencyTier(25)).toBe('sluggish');
    expect(computeEfficiencyTier(24)).toBe('blocked');
    expect(computeEfficiencyTier(0)).toBe('blocked');
  });
});

describe('analyzeAgentWorkflowTransitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when no sessions', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 'ticket-1', status: 'backlog', createdAt: new Date(), updatedAt: new Date() }]);
          return Promise.resolve([]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentWorkflowTransitions('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('identifies fastestAgent as agent with lowest avgTransitionTimeHours', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([{ id: 't1', status: 'done', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') }]);
          }
          return Promise.resolve([
            {
              personaType: 'FastAgent',
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T11:00:00Z'), // 1h
              status: 'completed',
              outputSummary: null,
            },
            {
              personaType: 'SlowAgent',
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T22:00:00Z'), // 12h
              status: 'completed',
              outputSummary: null,
            },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentWorkflowTransitions('proj-2');
    expect(report.summary.fastestAgent).toBe('FastAgent');
  });

  it('computes stalledTotal as sum of all stalledTickets across agents', async () => {
    const pastStart = new Date(Date.now() - 25 * 3600 * 1000); // 25h ago
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([{ id: 't1', status: 'in_progress', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }]);
          }
          return Promise.resolve([
            {
              personaType: 'AgentA',
              startedAt: pastStart,
              completedAt: null, // stalled
              status: 'running',
              outputSummary: null,
            },
            {
              personaType: 'AgentB',
              startedAt: pastStart,
              completedAt: null, // stalled
              status: 'running',
              outputSummary: null,
            },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentWorkflowTransitions('proj-3');
    expect(report.summary.stalledTotal).toBe(2);
  });

  it('fluidAgents counts only fluid tier agents', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([{ id: 't1', status: 'done', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') }]);
          }
          return Promise.resolve([
            // Fast agent: very fast transitions → fluid
            {
              personaType: 'FastAgent',
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T10:01:00Z'),
              status: 'completed',
              outputSummary: null,
            },
            // Slow agent: > 48h → blocked
            {
              personaType: 'SlowAgent',
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-04T10:00:00Z'),
              status: 'completed',
              outputSummary: null,
            },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentWorkflowTransitions('proj-4');
    // FastAgent transitions in 1 min → score near 100 → fluid
    expect(report.summary.fluidAgents).toBeGreaterThanOrEqual(1);
  });
});
