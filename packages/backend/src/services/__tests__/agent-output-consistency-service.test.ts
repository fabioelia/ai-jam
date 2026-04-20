import { describe, it, expect } from 'vitest';
import {
  computeOutputConsistencyScore,
  computeConsistencyTier,
  buildOutputConsistencyMetrics,
} from '../agent-output-consistency-service.js';

describe('computeConsistencyScore', () => {
  it('returns 0 for all zero inputs', () => {
    expect(computeOutputConsistencyScore(0, 0)).toBe(0);
  });

  it('returns 100 for 100% consistency and 100% format adherence', () => {
    expect(computeOutputConsistencyScore(100, 100)).toBe(100);
  });

  it('returns 50 for 50% consistency and 50% format adherence', () => {
    expect(computeOutputConsistencyScore(50, 50)).toBe(50);
  });
});

describe('computeConsistencyTier', () => {
  it('returns consistent tier at score >= 80', () => {
    const tier = computeConsistencyTier(80);
    expect(['consistent', 'stable']).toContain(tier);
  });

  it('returns variable tier at score >= 60', () => {
    const tier = computeConsistencyTier(60);
    expect(tier).toBe('variable');
  });

  it('returns erratic tier at score >= 40', () => {
    const tier = computeConsistencyTier(40);
    expect(tier).toBe('erratic');
  });

  it('returns unreliable tier at score < 40', () => {
    expect(computeConsistencyTier(0)).toBe('unreliable');
    expect(computeConsistencyTier(39)).toBe('unreliable');
  });
});

describe('buildOutputConsistencyMetrics', () => {
  it('returns empty array when no sessions', () => {
    const result = buildOutputConsistencyMetrics([]);
    expect(result).toEqual([]);
  });

  it('builds metrics correctly for completed sessions', () => {
    const sessions = [
      { id: '1', ticketId: 't1', personaType: 'developer', status: 'completed', outputSummary: 'Done' },
      { id: '2', ticketId: 't2', personaType: 'developer', status: 'failed', outputSummary: null },
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    expect(result.length).toBe(1);
    expect(result[0].agentId).toBe('developer');
    expect(result[0].totalOutputs).toBe(2);
    expect(result[0].consistentOutputs).toBe(1);
  });

  it('groups sessions by persona correctly', () => {
    const sessions = [
      { id: '1', ticketId: 't1', personaType: 'dev', status: 'completed', outputSummary: 'Done' },
      { id: '2', ticketId: 't2', personaType: 'qa', status: 'completed', outputSummary: 'Tested' },
    ];
    const result = buildOutputConsistencyMetrics(sessions);
    expect(result.length).toBe(2);
  });
});
