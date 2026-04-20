import { describe, it, expect, vi } from 'vitest';
import { computeAutonomyScore, getAutonomyTier } from '../agent-autonomy-index-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));

describe('computeAutonomyScore', () => {
  it('returns 100 for perfect autonomy (rate=1, 0 handoffs)', () => {
    expect(computeAutonomyScore(1, 0)).toBe(100);
  });

  it('returns 0 for zero autonomy rate and max handoffs', () => {
    expect(computeAutonomyScore(0, 5)).toBe(0);
  });

  it('caps avgHandoffsPerSession at 5 for bonus calculation', () => {
    const score5 = computeAutonomyScore(0.5, 5);
    const score10 = computeAutonomyScore(0.5, 10);
    expect(score5).toBe(score10);
  });

  it('weighs autonomyRate at 70%', () => {
    const highRate = computeAutonomyScore(1, 2);
    const lowRate = computeAutonomyScore(0, 2);
    expect(highRate).toBeGreaterThan(lowRate);
  });

  it('is clamped between 0 and 100', () => {
    expect(computeAutonomyScore(2, -1)).toBeLessThanOrEqual(100);
    expect(computeAutonomyScore(-1, 10)).toBeGreaterThanOrEqual(0);
  });
});

describe('getAutonomyTier', () => {
  it('returns highly_autonomous for score >= 80', () => {
    expect(getAutonomyTier(80)).toBe('highly_autonomous');
    expect(getAutonomyTier(100)).toBe('highly_autonomous');
  });

  it('returns autonomous for 60 <= score < 80', () => {
    expect(getAutonomyTier(60)).toBe('autonomous');
    expect(getAutonomyTier(79)).toBe('autonomous');
  });

  it('returns semi_autonomous for 35 <= score < 60', () => {
    expect(getAutonomyTier(35)).toBe('semi_autonomous');
    expect(getAutonomyTier(59)).toBe('semi_autonomous');
  });

  it('returns dependent for score < 35', () => {
    expect(getAutonomyTier(34)).toBe('dependent');
    expect(getAutonomyTier(0)).toBe('dependent');
  });
});
