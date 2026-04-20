import { describe, it, expect } from 'vitest';
import {
  computeAdaptationScore,
  computeAdaptationTier,
} from '../agent-adaptation-speed-service.js';

describe('computeAdaptationScore', () => {
  it('returns 0 for all zero inputs', () => {
    const score = computeAdaptationScore({ feedbackIncorporationRate: 0, avgIterationsToSuccess: 5, requirementChangeCount: 0 });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns high score for 100% feedback rate', () => {
    const score = computeAdaptationScore({ feedbackIncorporationRate: 100, avgIterationsToSuccess: 1, requirementChangeCount: 5 });
    expect(score).toBeGreaterThan(50);
  });

  it('adds bonus for requirementChangeCount >= 5', () => {
    const scoreHigh = computeAdaptationScore({ feedbackIncorporationRate: 50, avgIterationsToSuccess: 1, requirementChangeCount: 5 });
    const scoreLow = computeAdaptationScore({ feedbackIncorporationRate: 50, avgIterationsToSuccess: 1, requirementChangeCount: 0 });
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('adds smaller bonus for requirementChangeCount >= 2', () => {
    const scoreMed = computeAdaptationScore({ feedbackIncorporationRate: 50, avgIterationsToSuccess: 1, requirementChangeCount: 2 });
    const scoreLow = computeAdaptationScore({ feedbackIncorporationRate: 50, avgIterationsToSuccess: 1, requirementChangeCount: 0 });
    expect(scoreMed).toBeGreaterThan(scoreLow);
  });
});

describe('computeAdaptationTier', () => {
  it('rapid at score >= 75', () => {
    expect(computeAdaptationTier(75)).toBe('rapid');
    expect(computeAdaptationTier(100)).toBe('rapid');
  });

  it('responsive at score >= 55', () => {
    expect(computeAdaptationTier(55)).toBe('responsive');
    expect(computeAdaptationTier(74)).toBe('responsive');
  });

  it('gradual at score >= 35', () => {
    expect(computeAdaptationTier(35)).toBe('gradual');
    expect(computeAdaptationTier(54)).toBe('gradual');
  });

  it('resistant at score < 35', () => {
    expect(computeAdaptationTier(0)).toBe('resistant');
    expect(computeAdaptationTier(34)).toBe('resistant');
  });
});
