import { describe, it, expect } from 'vitest';
import {
  computeConsistencyScore,
  computeConsistencyTier,
} from './agent-output-consistency-service.js';

describe('computeConsistencyScore', () => {
  it('returns formatConsistencyRate as base with no bonus or penalty', () => {
    // variance 200 (not <100, not >500), rate 70 (not >=80)
    expect(computeConsistencyScore(70, 200)).toBe(70);
  });

  it('applies +10 bonus when variance < 100 AND rate >= 80', () => {
    expect(computeConsistencyScore(80, 50)).toBe(90);
  });

  it('does not apply bonus when rate < 80 even if variance < 100', () => {
    expect(computeConsistencyScore(79, 50)).toBe(79);
  });

  it('applies -15 penalty when variance > 500', () => {
    expect(computeConsistencyScore(60, 600)).toBe(45);
  });

  it('clamps result to 100 max', () => {
    // rate 95 + bonus 10 = 105 → clamped to 100
    expect(computeConsistencyScore(95, 50)).toBe(100);
  });

  it('clamps result to 0 min', () => {
    // rate 10 - penalty 15 = -5 → clamped to 0
    expect(computeConsistencyScore(10, 600)).toBe(0);
  });

  it('returns 100 when rate 100 and variance < 100', () => {
    expect(computeConsistencyScore(100, 50)).toBe(100);
  });

  it('returns 0 when rate 0 and variance > 500', () => {
    expect(computeConsistencyScore(0, 600)).toBe(0);
  });
});

describe('computeConsistencyTier', () => {
  it('returns stable for score >= 85', () => {
    expect(computeConsistencyTier(85)).toBe('stable');
    expect(computeConsistencyTier(100)).toBe('stable');
  });

  it('returns mostly-stable for score 65-84', () => {
    expect(computeConsistencyTier(65)).toBe('mostly-stable');
    expect(computeConsistencyTier(84)).toBe('mostly-stable');
  });

  it('returns variable for score 40-64', () => {
    expect(computeConsistencyTier(40)).toBe('variable');
    expect(computeConsistencyTier(64)).toBe('variable');
  });

  it('returns erratic for score < 40', () => {
    expect(computeConsistencyTier(39)).toBe('erratic');
    expect(computeConsistencyTier(0)).toBe('erratic');
  });
});
