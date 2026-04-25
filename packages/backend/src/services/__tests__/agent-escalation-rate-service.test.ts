import { describe, it, expect } from 'vitest';
import {
  computeEscalationScore,
  getEscalationTier,
  getEscalationTierLabel,
  formatEscalationRate,
} from '../agent-escalation-rate-service.js';

describe('computeEscalationScore', () => {
  it('returns 0 for insufficient data (totalTickets < 3)', () => {
    expect(computeEscalationScore(0, 0, 2)).toBe(0);
    expect(computeEscalationScore(0, 0, 1)).toBe(0);
    expect(computeEscalationScore(0, 0, 0)).toBe(0);
  });

  it('computes score for very low escalation rate (0)', () => {
    // escalationRate=0: score = 90 - 0*100 = 90
    expect(computeEscalationScore(0, 0, 5)).toBe(90);
  });

  it('computes score at escalationRate=0.1 boundary', () => {
    // score = 90 - 0.1*100 = 80
    expect(computeEscalationScore(0.1, 0.1, 5)).toBe(80);
  });

  it('computes score at escalationRate=0.2 (mid low range)', () => {
    // score = 80 - ((0.2-0.1)/0.2)*30 = 80 - 15 = 65
    expect(computeEscalationScore(0.2, 0.2, 5)).toBe(65);
  });

  it('computes score at escalationRate=0.3 boundary', () => {
    // score = 80 - ((0.3-0.1)/0.2)*30 = 80 - 30 = 50
    expect(computeEscalationScore(0.3, 0.3, 5)).toBe(50);
  });

  it('computes score at escalationRate=0.45 (mid mid range)', () => {
    // score = 50 - ((0.45-0.3)/0.3)*30 = 50 - 15 = 35
    expect(computeEscalationScore(0.45, 0.45, 5)).toBe(35);
  });

  it('computes score at escalationRate=0.6 boundary', () => {
    // score = 50 - ((0.6-0.3)/0.3)*30 = 50 - 30 = 20
    expect(computeEscalationScore(0.6, 0.6, 5)).toBe(20);
  });

  it('computes score for high escalation rate (0.8)', () => {
    // score = max(0, 20 - ((0.8-0.6)/0.4)*20) = max(0, 20-10) = 10
    expect(computeEscalationScore(0.8, 0.8, 5)).toBe(10);
  });

  it('clamps to 0 for very high escalation rate (1.0)', () => {
    // score = max(0, 20 - ((1.0-0.6)/0.4)*20) = max(0, 20-20) = 0
    expect(computeEscalationScore(1.0, 1.0, 5)).toBe(0);
  });
});

describe('getEscalationTier', () => {
  it('returns insufficient_data when totalTickets < 3', () => {
    expect(getEscalationTier(90, 2)).toBe('insufficient_data');
    expect(getEscalationTier(90, 0)).toBe('insufficient_data');
  });

  it('returns autonomous for score >= 80', () => {
    expect(getEscalationTier(80, 5)).toBe('autonomous');
    expect(getEscalationTier(90, 5)).toBe('autonomous');
    expect(getEscalationTier(100, 5)).toBe('autonomous');
  });

  it('returns low_escalation for score >= 55 and < 80', () => {
    expect(getEscalationTier(55, 5)).toBe('low_escalation');
    expect(getEscalationTier(79, 5)).toBe('low_escalation');
  });

  it('returns high_escalation for score >= 30 and < 55', () => {
    expect(getEscalationTier(30, 5)).toBe('high_escalation');
    expect(getEscalationTier(54, 5)).toBe('high_escalation');
  });

  it('returns chronic_escalator for score < 30', () => {
    expect(getEscalationTier(0, 5)).toBe('chronic_escalator');
    expect(getEscalationTier(29, 5)).toBe('chronic_escalator');
  });
});

describe('getEscalationTierLabel', () => {
  it('returns correct labels for all tiers', () => {
    expect(getEscalationTierLabel('autonomous')).toBe('Autonomous');
    expect(getEscalationTierLabel('low_escalation')).toBe('Low Escalation');
    expect(getEscalationTierLabel('high_escalation')).toBe('High Escalation');
    expect(getEscalationTierLabel('chronic_escalator')).toBe('Chronic Escalator');
    expect(getEscalationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });

  it('returns Insufficient Data for unknown tier', () => {
    expect(getEscalationTierLabel('unknown')).toBe('Insufficient Data');
  });
});

describe('formatEscalationRate', () => {
  it('formats rate as percentage with 1 decimal', () => {
    expect(formatEscalationRate(0)).toBe('0.0%');
    expect(formatEscalationRate(0.1)).toBe('10.0%');
    expect(formatEscalationRate(0.5)).toBe('50.0%');
    expect(formatEscalationRate(1.0)).toBe('100.0%');
  });

  it('formats fractional percentage correctly', () => {
    expect(formatEscalationRate(0.333)).toBe('33.3%');
    expect(formatEscalationRate(0.756)).toBe('75.6%');
  });
});
