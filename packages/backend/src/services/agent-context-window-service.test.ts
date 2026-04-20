import { describe, it, expect } from 'vitest';
import {
  buildContextWindowMetrics,
  computeContextEfficiencyScore,
  computeUtilizationTier,
} from './agent-context-window-service.js';

function makeSession(
  id: string,
  ticketId: string,
  personaType: string,
  status: string = 'completed',
) {
  return { id, ticketId, personaType, status };
}

describe('computeContextEfficiencyScore', () => {
  it('gives bonus 20 when no overflows and 0 overflow penalty', () => {
    const score = computeContextEfficiencyScore(50, 0);
    // 50 * 0.6 + 20 (noOverflow) + 20 (0 * 5 penalty → max(0,20-0)) = 30 + 20 + 20 = 70
    expect(score).toBe(70);
  });

  it('reduces score with overflow penalty', () => {
    const score = computeContextEfficiencyScore(50, 2);
    // 50 * 0.6 + 0 (has overflows) + max(0, 20 - 2*5) = 30 + 0 + 10 = 40
    expect(score).toBe(40);
  });

  it('zero overflow bonus when overflows >= 4', () => {
    const score = computeContextEfficiencyScore(50, 4);
    // 50 * 0.6 + 0 + max(0, 20-20) = 30
    expect(score).toBe(30);
  });

  it('clamps to 100 max', () => {
    const score = computeContextEfficiencyScore(100, 0);
    // 100 * 0.6 + 20 + 20 = 100 → clamped 100
    expect(score).toBe(100);
  });
});

describe('computeUtilizationTier', () => {
  it('returns optimal for score >= 80', () => {
    expect(computeUtilizationTier(80)).toBe('optimal');
    expect(computeUtilizationTier(100)).toBe('optimal');
  });

  it('returns efficient for score >= 60', () => {
    expect(computeUtilizationTier(60)).toBe('efficient');
    expect(computeUtilizationTier(79)).toBe('efficient');
  });

  it('returns wasteful for score >= 40', () => {
    expect(computeUtilizationTier(40)).toBe('wasteful');
    expect(computeUtilizationTier(59)).toBe('wasteful');
  });

  it('returns overloaded for score < 40', () => {
    expect(computeUtilizationTier(39)).toBe('overloaded');
    expect(computeUtilizationTier(0)).toBe('overloaded');
  });
});

describe('buildContextWindowMetrics', () => {
  it('returns empty array when no sessions', () => {
    const result = buildContextWindowMetrics([], new Map());
    expect(result).toEqual([]);
  });

  it('computes avgWindowUsage from note counts', () => {
    const sessions = [makeSession('s1', 't1', 'agentA')];
    const notesByTicket = new Map([['t1', 5]]);
    const result = buildContextWindowMetrics(sessions, notesByTicket);
    const agentA = result.find((a) => a.agentId === 'agentA')!;
    // 5 notes * 10 = 50% usage
    expect(agentA.avgWindowUsage).toBe(50);
  });

  it('counts sessions with notes > 20 as overflows', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentB'),
      makeSession('s2', 't2', 'agentB'),
    ];
    const notesByTicket = new Map([['t1', 25], ['t2', 3]]);
    const result = buildContextWindowMetrics(sessions, notesByTicket);
    const agentB = result.find((a) => a.agentId === 'agentB')!;
    expect(agentB.windowOverflows).toBe(1);
  });

  it('uses 0 notes when ticket not in notesByTicket map', () => {
    const sessions = [makeSession('s1', 't1', 'agentC')];
    const result = buildContextWindowMetrics(sessions, new Map());
    const agentC = result.find((a) => a.agentId === 'agentC')!;
    expect(agentC.avgWindowUsage).toBe(0);
    expect(agentC.windowOverflows).toBe(0);
  });

  it('computes peakUsage as max across sessions', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentD'),
      makeSession('s2', 't2', 'agentD'),
    ];
    const notesByTicket = new Map([['t1', 3], ['t2', 8]]);
    const result = buildContextWindowMetrics(sessions, notesByTicket);
    const agentD = result.find((a) => a.agentId === 'agentD')!;
    // peak = max(30, 80) = 80
    expect(agentD.peakUsage).toBe(80);
  });

  it('sorts agents by contextEfficiencyScore descending', () => {
    const sessions = [
      makeSession('s1', 't1', 'lowAgent'),
      makeSession('s2', 't2', 'highAgent'),
    ];
    const notesByTicket = new Map([['t1', 25], ['t2', 2]]);
    const result = buildContextWindowMetrics(sessions, notesByTicket);
    expect(result[0].contextEfficiencyScore).toBeGreaterThanOrEqual(result[result.length - 1].contextEfficiencyScore);
  });

  it('groups sessions by personaType correctly', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentE'),
      makeSession('s2', 't2', 'agentE'),
      makeSession('s3', 't3', 'agentF'),
    ];
    const notesByTicket = new Map([['t1', 2], ['t2', 4], ['t3', 6]]);
    const result = buildContextWindowMetrics(sessions, notesByTicket);
    expect(result.length).toBe(2);
    const agentE = result.find((a) => a.agentId === 'agentE')!;
    // avg of (20, 40) = 30
    expect(agentE.avgWindowUsage).toBe(30);
  });

  it('agentName is formatted from personaType', () => {
    const sessions = [makeSession('s1', 't1', 'my_agent')];
    const result = buildContextWindowMetrics(sessions, new Map());
    const agent = result.find((a) => a.agentId === 'my_agent')!;
    expect(agent.agentName).toBe('My agent');
  });
});
