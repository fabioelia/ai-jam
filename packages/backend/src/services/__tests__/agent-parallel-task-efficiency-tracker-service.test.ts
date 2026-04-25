import { describe, it, expect } from 'vitest';
import {
  computeParallelEfficiencyScore,
  getEfficiencyTier,
  getEfficiencyTierLabel,
  formatDegradationRatio,
  formatConcurrency,
} from '../agent-parallel-task-efficiency-tracker-service.js';

describe('computeParallelEfficiencyScore', () => {
  it('returns 0 for insufficient data (totalTickets < 5)', () => {
    expect(computeParallelEfficiencyScore(1.0, 1, 4)).toBe(0);
  });

  it('scores ~90 at degradation ratio 1.0', () => {
    expect(computeParallelEfficiencyScore(1.0, 1, 10)).toBeCloseTo(90, 0);
  });

  it('scores correctly at ratio 1.05', () => {
    const score = computeParallelEfficiencyScore(1.05, 1, 10);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(90);
  });

  it('scores at boundary ratio 1.1', () => {
    const score = computeParallelEfficiencyScore(1.1, 1, 10);
    expect(score).toBeCloseTo(80, 0);
  });

  it('scores in moderate range at ratio 1.3', () => {
    const score = computeParallelEfficiencyScore(1.3, 1, 10);
    expect(score).toBeGreaterThan(55);
    expect(score).toBeLessThan(80);
  });

  it('scores at boundary ratio 1.5', () => {
    const score = computeParallelEfficiencyScore(1.5, 1, 10);
    expect(score).toBeCloseTo(50, 0);
  });

  it('scores in declining range at ratio 1.75', () => {
    const score = computeParallelEfficiencyScore(1.75, 1, 10);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(50);
  });

  it('scores at boundary ratio 2.0', () => {
    const score = computeParallelEfficiencyScore(2.0, 1, 10);
    expect(score).toBeCloseTo(20, 0);
  });

  it('scores near 0 at ratio 2.5', () => {
    const score = computeParallelEfficiencyScore(2.5, 1, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(20);
  });

  it('returns 0 at ratio 3.0', () => {
    expect(computeParallelEfficiencyScore(3.0, 1, 10)).toBe(0);
  });
});

describe('getEfficiencyTier', () => {
  it('returns insufficient_data when totalTickets < 5', () => {
    expect(getEfficiencyTier(90, 4)).toBe('insufficient_data');
  });

  it('returns highly_efficient for score >= 80', () => {
    expect(getEfficiencyTier(90, 10)).toBe('highly_efficient');
    expect(getEfficiencyTier(80, 10)).toBe('highly_efficient');
  });

  it('returns moderately_efficient for score >= 55', () => {
    expect(getEfficiencyTier(65, 10)).toBe('moderately_efficient');
    expect(getEfficiencyTier(55, 10)).toBe('moderately_efficient');
  });

  it('returns low_efficiency for score >= 30', () => {
    expect(getEfficiencyTier(45, 10)).toBe('low_efficiency');
    expect(getEfficiencyTier(30, 10)).toBe('low_efficiency');
  });

  it('returns parallel_bottleneck for score < 30', () => {
    expect(getEfficiencyTier(0, 10)).toBe('parallel_bottleneck');
    expect(getEfficiencyTier(29, 10)).toBe('parallel_bottleneck');
  });
});

describe('getEfficiencyTierLabel', () => {
  it('maps all tiers to labels', () => {
    expect(getEfficiencyTierLabel('highly_efficient')).toBe('Highly Efficient');
    expect(getEfficiencyTierLabel('moderately_efficient')).toBe('Moderately Efficient');
    expect(getEfficiencyTierLabel('low_efficiency')).toBe('Low Efficiency');
    expect(getEfficiencyTierLabel('parallel_bottleneck')).toBe('Parallel Bottleneck');
    expect(getEfficiencyTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatDegradationRatio', () => {
  it('formats 1.00 as 1.00x', () => expect(formatDegradationRatio(1.0)).toBe('1.00x'));
  it('formats 1.50 as 1.50x', () => expect(formatDegradationRatio(1.5)).toBe('1.50x'));
  it('formats 2.00 as 2.00x', () => expect(formatDegradationRatio(2.0)).toBe('2.00x'));
});

describe('formatConcurrency', () => {
  it('formats 1.0 as 1.0 tasks', () => expect(formatConcurrency(1.0)).toBe('1.0 tasks'));
  it('formats 3.5 as 3.5 tasks', () => expect(formatConcurrency(3.5)).toBe('3.5 tasks'));
});
