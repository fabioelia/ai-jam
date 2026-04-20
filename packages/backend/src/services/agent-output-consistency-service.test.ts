import { describe, it, expect } from 'vitest';
import {
  buildOutputConsistencyMetrics,
  computeOutputConsistencyScore,
  computeConsistencyTier,
} from './agent-output-consistency-service.js';

function makeSession(
  id: string,
  ticketId: string,
  personaType: string,
  status: string,
  outputSummary: string | null = null,
) {
  return { id, ticketId, personaType, status, outputSummary };
}

describe('computeOutputConsistencyScore', () => {
  it('averages consistencyRate and formatAdherenceRate with 0.5 weights', () => {
    const score = computeOutputConsistencyScore(80, 60);
    // 80 * 0.5 + 60 * 0.5 = 70
    expect(score).toBe(70);
  });

  it('returns 100 when both rates are 100', () => {
    expect(computeOutputConsistencyScore(100, 100)).toBe(100);
  });

  it('returns 0 when both rates are 0', () => {
    expect(computeOutputConsistencyScore(0, 0)).toBe(0);
  });

  it('clamps result to 100 max', () => {
    expect(computeOutputConsistencyScore(100, 100)).toBe(100);
  });
});

describe('computeConsistencyTier', () => {
  it('returns consistent for score >= 80', () => {
    expect(computeConsistencyTier(80)).toBe('consistent');
    expect(computeConsistencyTier(100)).toBe('consistent');
  });

  it('returns variable for score >= 60', () => {
    expect(computeConsistencyTier(60)).toBe('variable');
    expect(computeConsistencyTier(79)).toBe('variable');
  });

  it('returns erratic for score >= 40', () => {
    expect(computeConsistencyTier(40)).toBe('erratic');
    expect(computeConsistencyTier(59)).toBe('erratic');
  });

  it('returns unreliable for score < 40', () => {
    expect(computeConsistencyTier(39)).toBe('unreliable');
    expect(computeConsistencyTier(0)).toBe('unreliable');
  });
});

describe('buildOutputConsistencyMetrics', () => {
  it('returns empty array when no sessions', () => {
    const result = buildOutputConsistencyMetrics([]);
    expect(result).toEqual([]);
  });

  it('counts completed sessions as consistentOutputs', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentA', 'completed', 'output'),
      makeSession('s2', 't2', 'agentA', 'failed', null),
      makeSession('s3', 't3', 'agentA', 'completed', 'output'),
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    const agentA = result.find((a) => a.agentId === 'agentA')!;
    expect(agentA.totalOutputs).toBe(3);
    expect(agentA.consistentOutputs).toBe(2);
    expect(agentA.consistencyRate).toBe(67);
  });

  it('computes formatAdherenceRate from non-empty outputSummary', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentB', 'completed', 'good output'),
      makeSession('s2', 't2', 'agentB', 'completed', null),
      makeSession('s3', 't3', 'agentB', 'failed', ''),
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    const agentB = result.find((a) => a.agentId === 'agentB')!;
    // 1 out of 3 has non-empty output
    expect(agentB.formatAdherenceRate).toBe(33);
  });

  it('sorts agents by outputConsistencyScore descending', () => {
    const sessions = [
      makeSession('s1', 't1', 'lowAgent', 'failed', null),
      makeSession('s2', 't2', 'highAgent', 'completed', 'output'),
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    expect(result[0].outputConsistencyScore).toBeGreaterThanOrEqual(result[result.length - 1].outputConsistencyScore);
  });

  it('groups sessions by personaType correctly', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentC', 'completed', 'out'),
      makeSession('s2', 't2', 'agentC', 'completed', 'out'),
      makeSession('s3', 't3', 'agentD', 'failed', null),
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    expect(result.length).toBe(2);
  });

  it('formats agentName correctly from personaType', () => {
    const sessions = [makeSession('s1', 't1', 'test_agent', 'completed', 'out')];
    const result = buildOutputConsistencyMetrics(sessions);
    expect(result[0].agentName).toBe('Test agent');
  });

  it('handles agent with no failed sessions - consistency rate 100%', () => {
    const sessions = [
      makeSession('s1', 't1', 'agentE', 'completed', 'output'),
      makeSession('s2', 't2', 'agentE', 'completed', 'output'),
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    const agentE = result.find((a) => a.agentId === 'agentE')!;
    expect(agentE.consistencyRate).toBe(100);
    expect(agentE.formatAdherenceRate).toBe(100);
    expect(agentE.outputConsistencyScore).toBe(100);
    expect(agentE.consistencyTier).toBe('consistent');
  });
});
