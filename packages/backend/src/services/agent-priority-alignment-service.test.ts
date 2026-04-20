import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computePriorityWeightedScore, getPriorityAlignmentTier } from './agent-priority-alignment-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));

describe('computePriorityWeightedScore', () => {
  it('returns high score for high criticalResolutionRate and highPriorityFocusRate', () => {
    const score = computePriorityWeightedScore(100, 100, 0, 10);
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it('returns 0 for all-zero inputs', () => {
    const score = computePriorityWeightedScore(0, 0, 0, 0);
    expect(score).toBe(0);
  });

  it('speed ratio uses avgLowTimeHours > 0', () => {
    const withLow = computePriorityWeightedScore(50, 50, 5, 10);
    const withoutLow = computePriorityWeightedScore(50, 50, 5, 0);
    expect(withLow).not.toBe(withoutLow);
  });

  it('is clamped between 0 and 100', () => {
    const score = computePriorityWeightedScore(200, 200, 0, 1);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('getPriorityAlignmentTier', () => {
  it('returns aligned for score >= 75', () => {
    expect(getPriorityAlignmentTier(75)).toBe('aligned');
    expect(getPriorityAlignmentTier(100)).toBe('aligned');
  });

  it('returns balanced for 50 <= score < 75', () => {
    expect(getPriorityAlignmentTier(50)).toBe('balanced');
    expect(getPriorityAlignmentTier(74)).toBe('balanced');
  });

  it('returns inconsistent for 25 <= score < 50', () => {
    expect(getPriorityAlignmentTier(25)).toBe('inconsistent');
    expect(getPriorityAlignmentTier(49)).toBe('inconsistent');
  });

  it('returns misaligned for score < 25', () => {
    expect(getPriorityAlignmentTier(24)).toBe('misaligned');
    expect(getPriorityAlignmentTier(0)).toBe('misaligned');
  });
});
