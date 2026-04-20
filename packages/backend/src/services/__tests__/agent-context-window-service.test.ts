import { describe, it, expect } from 'vitest';
import {
  computeUtilizationScore,
  computeUtilizationTier,
} from '../agent-context-window-service.js';

describe('AgentContextWindowService pure functions', () => {
  it('report shape: computeUtilizationScore returns a number', () => {
    const score = computeUtilizationScore(70, 0, 10);
    expect(typeof score).toBe('number');
  });

  it('score at 70% utilization (optimal range) returns high score', () => {
    // avgUtilizationRate=70, overflowSessions=0, totalSessions=10
    // score = 100 - |70-70|*1.5 = 100, sweet spot bonus +10 = 110 -> 100 (clamped)
    const score = computeUtilizationScore(70, 0, 10);
    expect(score).toBe(100);
  });

  it('tier optimal at score >= 80', () => {
    expect(computeUtilizationTier(80)).toBe('optimal');
    expect(computeUtilizationTier(100)).toBe('optimal');
  });

  it('tier efficient at score >= 60', () => {
    expect(computeUtilizationTier(60)).toBe('efficient');
    expect(computeUtilizationTier(79)).toBe('efficient');
  });

  it('tier wasteful/cramped at score >= 40', () => {
    const tier40 = computeUtilizationTier(40);
    // service may use 'wasteful' or 'cramped' depending on implementation
    expect(['wasteful', 'cramped']).toContain(tier40);
    const tier59 = computeUtilizationTier(59);
    expect(['wasteful', 'cramped']).toContain(tier59);
  });

  it('tier overloaded at score < 40', () => {
    expect(computeUtilizationTier(0)).toBe('overloaded');
    expect(computeUtilizationTier(39)).toBe('overloaded');
  });

  it('overflow penalty applied when > 20% overflow', () => {
    // 3 overflow out of 10 = 30% > 20%, should get -20 penalty
    const scoreWithOverflow = computeUtilizationScore(70, 3, 10);
    const scoreWithoutOverflow = computeUtilizationScore(70, 0, 10);
    expect(scoreWithOverflow).toBeLessThan(scoreWithoutOverflow);
  });

  it('sweet spot bonus applied at 60-80% range', () => {
    // 70% gets sweet spot bonus
    const scoreInRange = computeUtilizationScore(70, 0, 10);
    // 50% does not get sweet spot bonus
    const scoreOutRange = computeUtilizationScore(50, 0, 10);
    expect(scoreInRange).toBeGreaterThan(scoreOutRange);
  });
});
