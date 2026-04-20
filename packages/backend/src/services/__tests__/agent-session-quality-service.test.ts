import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSessionQualityScore,
  computeSessionQualityTier,
  analyzeAgentSessionQuality,
} from '../agent-session-quality-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

import { db } from '../../db/connection.js';

describe('computeSessionQualityScore', () => {
  it('computes weighted formula correctly', () => {
    // outputCompleteness * 0.6 + handoffRate * 0.4
    expect(computeSessionQualityScore(100, 100)).toBe(100);
    expect(computeSessionQualityScore(50, 50)).toBe(50);
    expect(computeSessionQualityScore(0, 0)).toBe(0);
    // 80 * 0.6 + 50 * 0.4 = 48 + 20 = 68
    expect(computeSessionQualityScore(80, 50)).toBe(68);
  });

  it('clamps to [0, 100]', () => {
    expect(computeSessionQualityScore(200, 200)).toBe(100);
    expect(computeSessionQualityScore(-10, -10)).toBe(0);
  });
});

describe('computeSessionQualityTier', () => {
  it('returns excellent for score >= 80', () => {
    expect(computeSessionQualityTier(80)).toBe('excellent');
    expect(computeSessionQualityTier(100)).toBe('excellent');
  });

  it('returns good for score 60-79', () => {
    expect(computeSessionQualityTier(60)).toBe('good');
    expect(computeSessionQualityTier(79)).toBe('good');
  });

  it('returns adequate for score 40-59', () => {
    expect(computeSessionQualityTier(40)).toBe('adequate');
    expect(computeSessionQualityTier(59)).toBe('adequate');
  });

  it('returns poor for score < 40', () => {
    expect(computeSessionQualityTier(39)).toBe('poor');
    expect(computeSessionQualityTier(0)).toBe('poor');
  });
});

describe('analyzeAgentSessionQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when project has no tickets', async () => {
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-empty');
    expect(report.agents).toHaveLength(0);
    expect(report.avgQualityScore).toBe(0);
    expect(report.topAgent).toBeNull();
  });

  it('calculates outputCompleteness correctly', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 'ticket-1' }]);
          // 2 out of 3 sessions have outputSummary
          return Promise.resolve([
            { personaType: 'AgentA', outputSummary: 'Summary 1', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentA', outputSummary: 'Summary 2', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentA', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-1');
    expect(report.agents[0].outputCompleteness).toBeCloseTo(66.7, 0);
  });

  it('calculates handoffRate correctly', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 'ticket-1' }]);
          // 1 out of 2 completed
          return Promise.resolve([
            { personaType: 'AgentB', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-2');
    expect(report.agents[0].handoffRate).toBe(50);
  });

  it('calculates avgQualityScore correctly', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 'ticket-1' }]);
          return Promise.resolve([
            { personaType: 'AgentA', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-3');
    // AgentA: outputCompleteness=100, handoffRate=100 -> score=100
    // AgentB: outputCompleteness=0, handoffRate=0 -> score=0
    // avg = 50
    expect(report.avgQualityScore).toBe(50);
  });

  it('counts highQualityAgents correctly', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          // AgentA: score=100 (excellent), AgentB: score=0 (poor), AgentC: score=68 (good)
          return Promise.resolve([
            { personaType: 'AgentA', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
            { personaType: 'AgentC', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentC', outputSummary: 'done', status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-4');
    // AgentA: 100/100 excellent, AgentB: 0/0 poor, AgentC: 50oc/50hr -> score=50 adequate
    expect(report.highQualityAgents).toBeGreaterThanOrEqual(1);
  });

  it('populates sessionQualityCategories counts', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          return Promise.resolve([
            // AgentA: 100/100 -> excellent
            { personaType: 'AgentA', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
            // AgentB: 0/0 -> poor
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentSessionQuality('proj-5');
    expect(report.sessionQualityCategories.excellent).toBe(1);
    expect(report.sessionQualityCategories.poor).toBe(1);
    expect(report.sessionQualityCategories.good).toBe(0);
    expect(report.sessionQualityCategories.adequate).toBe(0);
  });
});
