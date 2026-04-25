import { describe, it, expect } from 'vitest';
import {
  computeVelocityScore,
  getVelocityTier,
  getVelocityTierLabel,
  getVelocityTrendLabel,
} from '../agent-task-completion-velocity-service.js';

describe('computeVelocityScore', () => {
  it('returns high score for active agents', () => {
    // avg=5, peak=6, recent=4 => 50 + 18 + 28 = 96
    expect(computeVelocityScore(5, 4, 6)).toBe(96);
  });

  it('returns moderate score for steady agents', () => {
    // avg=2, peak=3, recent=2 => 20 + 9 + 14 = 43
    expect(computeVelocityScore(2, 2, 3)).toBe(43);
  });

  it('returns low score for inactive agents', () => {
    // avg=0.5, peak=1, recent=0 => 5 + 3 + 0 = 8
    expect(computeVelocityScore(0.5, 0, 1)).toBe(8);
  });

  it('clamps at 100', () => {
    expect(computeVelocityScore(10, 10, 10)).toBe(100);
  });

  it('returns 0 for all zeros', () => {
    expect(computeVelocityScore(0, 0, 0)).toBe(0);
  });

  it('rounds to 1 decimal', () => {
    // avg=1.5, peak=2, recent=1 => 15 + 6 + 7 = 28
    const score = computeVelocityScore(1.5, 1, 2);
    expect(score).toBe(28);
  });
});

describe('getVelocityTier', () => {
  it('returns high for score >= 70', () => {
    expect(getVelocityTier(70, 5)).toBe('high');
    expect(getVelocityTier(100, 10)).toBe('high');
  });

  it('returns moderate for score >= 35', () => {
    expect(getVelocityTier(35, 5)).toBe('moderate');
    expect(getVelocityTier(69, 5)).toBe('moderate');
  });

  it('returns low for score >= 0', () => {
    expect(getVelocityTier(0, 5)).toBe('low');
    expect(getVelocityTier(34, 5)).toBe('low');
  });

  it('returns insufficient_data when < 2 completed sessions', () => {
    expect(getVelocityTier(90, 0)).toBe('insufficient_data');
    expect(getVelocityTier(90, 1)).toBe('insufficient_data');
  });
});

describe('getVelocityTierLabel', () => {
  it('maps high to High Velocity', () => {
    expect(getVelocityTierLabel('high')).toBe('High Velocity');
  });

  it('maps moderate to Steady', () => {
    expect(getVelocityTierLabel('moderate')).toBe('Steady');
  });

  it('maps low to Low Velocity', () => {
    expect(getVelocityTierLabel('low')).toBe('Low Velocity');
  });

  it('maps insufficient_data to Insufficient Data', () => {
    expect(getVelocityTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('getVelocityTrendLabel', () => {
  it('maps improving', () => {
    expect(getVelocityTrendLabel('improving')).toBe('↑ Improving');
  });

  it('maps declining', () => {
    expect(getVelocityTrendLabel('declining')).toBe('↓ Declining');
  });

  it('maps stable', () => {
    expect(getVelocityTrendLabel('stable')).toBe('→ Stable');
  });

  it('maps insufficient_data', () => {
    expect(getVelocityTrendLabel('insufficient_data')).toBe('— N/A');
  });
});
