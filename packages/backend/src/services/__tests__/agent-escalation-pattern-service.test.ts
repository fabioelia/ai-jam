import { describe, it, expect } from 'vitest';

// Test pure computation functions
function computeEscalationScore(escalationRate: number, unnecessaryEscalations: number, avgResolutionTime: number): number {
  let score = (1 - escalationRate) * 100;
  if (unnecessaryEscalations === 0) score += 10;
  if (avgResolutionTime > 60) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function computeEscalationTier(score: number): 'autonomous' | 'measured' | 'dependent' | 'over-reliant' {
  if (score >= 80) return 'autonomous';
  if (score >= 60) return 'measured';
  if (score >= 35) return 'dependent';
  return 'over-reliant';
}

function computeHotspotSeverity(pct: number): 'critical' | 'high' | 'moderate' | 'low' {
  if (pct >= 0.6) return 'critical';
  if (pct >= 0.4) return 'high';
  if (pct >= 0.2) return 'moderate';
  return 'low';
}

describe('computeEscalationScore', () => {
  it('returns high score for 0% escalation rate', () => {
    expect(computeEscalationScore(0, 0, 30)).toBeGreaterThanOrEqual(100);
  });

  it('adds bonus when no unnecessary escalations', () => {
    const withBonus = computeEscalationScore(0.1, 0, 30);
    const withoutBonus = computeEscalationScore(0.1, 1, 30);
    expect(withBonus).toBeGreaterThan(withoutBonus);
  });

  it('penalizes high resolution time > 60 min', () => {
    const scoreFast = computeEscalationScore(0.1, 0, 30);
    const scoreSlow = computeEscalationScore(0.1, 0, 90);
    expect(scoreFast).toBeGreaterThan(scoreSlow);
  });

  it('clamps to 0-100', () => {
    expect(computeEscalationScore(1, 5, 120)).toBeGreaterThanOrEqual(0);
    expect(computeEscalationScore(0, 0, 10)).toBeLessThanOrEqual(100);
  });
});

describe('computeEscalationTier', () => {
  it('autonomous at score >= 80', () => {
    expect(computeEscalationTier(80)).toBe('autonomous');
    expect(computeEscalationTier(100)).toBe('autonomous');
  });

  it('measured at score >= 60', () => {
    expect(computeEscalationTier(60)).toBe('measured');
    expect(computeEscalationTier(79)).toBe('measured');
  });

  it('dependent at score >= 35', () => {
    expect(computeEscalationTier(35)).toBe('dependent');
    expect(computeEscalationTier(59)).toBe('dependent');
  });

  it('over-reliant at score < 35', () => {
    expect(computeEscalationTier(0)).toBe('over-reliant');
    expect(computeEscalationTier(34)).toBe('over-reliant');
  });
});

describe('hotspot severity', () => {
  it('critical at >= 60% share', () => {
    expect(computeHotspotSeverity(0.6)).toBe('critical');
  });

  it('high at >= 40% share', () => {
    expect(computeHotspotSeverity(0.4)).toBe('high');
  });

  it('moderate at >= 20% share', () => {
    expect(computeHotspotSeverity(0.2)).toBe('moderate');
  });

  it('low at < 20% share', () => {
    expect(computeHotspotSeverity(0.1)).toBe('low');
  });
});
