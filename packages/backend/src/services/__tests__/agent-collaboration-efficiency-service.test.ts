import { describe, it, expect } from 'vitest';
import {
  computeCollaborationScore,
  computeCollaborationTier,
  computeNetworkDensity,
  buildCollaborationMetrics,
} from '../agent-collaboration-efficiency-service.js';

describe('computeCollaborationScore', () => {
  it('returns 0 for all zero inputs', () => {
    expect(computeCollaborationScore(0, 0, 0, 0)).toBe(0);
  });

  it('returns high score for high rates and high handoffs', () => {
    const score = computeCollaborationScore(100, 100, 10, 10);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('uses correct formula weights', () => {
    // continuationRate=50, contextUtilizationRate=50, handoffs=0
    // score = 50*0.4 + 50*0.4 + 0 = 40
    const score = computeCollaborationScore(50, 50, 0, 0);
    expect(score).toBe(40);
  });
});

describe('computeCollaborationTier', () => {
  it('synergistic at score >= 80', () => {
    expect(computeCollaborationTier(80)).toBe('synergistic');
    expect(computeCollaborationTier(100)).toBe('synergistic');
  });

  it('cooperative at score >= 60', () => {
    expect(computeCollaborationTier(60)).toBe('cooperative');
    expect(computeCollaborationTier(79)).toBe('cooperative');
  });

  it('independent at score >= 40', () => {
    expect(computeCollaborationTier(40)).toBe('independent');
    expect(computeCollaborationTier(59)).toBe('independent');
  });

  it('isolated at score < 40', () => {
    expect(computeCollaborationTier(0)).toBe('isolated');
    expect(computeCollaborationTier(39)).toBe('isolated');
  });
});

describe('computeNetworkDensity', () => {
  it('returns 0 for fewer than 2 agents', () => {
    expect(computeNetworkDensity(1, [])).toBe(0);
    expect(computeNetworkDensity(0, [])).toBe(0);
  });

  it('returns density based on unique pairs', () => {
    const notes = [
      { handoffFrom: 'A', handoffTo: 'B' },
      { handoffFrom: 'B', handoffTo: 'C' },
    ];
    // 3 agents, 3 possible pairs, 2 actual unique pairs = 0.67 -> but only 2 agents from notes
    const density = computeNetworkDensity(3, notes);
    expect(density).toBeGreaterThan(0);
    expect(density).toBeLessThanOrEqual(1);
  });
});

describe('buildCollaborationMetrics', () => {
  it('returns empty array when no sessions or notes', () => {
    expect(buildCollaborationMetrics([], [])).toEqual([]);
  });

  it('groups agents from sessions and notes', () => {
    const sessions = [
      { id: '1', personaType: 'dev', status: 'completed', outputSummary: 'Done' },
    ];
    const notes = [
      { handoffFrom: 'dev', handoffTo: 'qa' },
    ];
    const metrics = buildCollaborationMetrics(sessions, notes);
    expect(metrics.length).toBeGreaterThanOrEqual(1);
  });
});
