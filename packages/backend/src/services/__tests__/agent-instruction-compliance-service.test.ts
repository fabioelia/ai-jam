import { describe, it, expect } from 'vitest';
import {
  computeComplianceScore,
  computeComplianceTier,
  computeViolationSeverity,
  buildComplianceMetrics,
} from '../agent-instruction-compliance-service.js';

describe('computeViolationSeverity', () => {
  it('returns minor when violation ratio < 5%', () => {
    expect(computeViolationSeverity(0, 100)).toBe('minor');
    expect(computeViolationSeverity(4, 100)).toBe('minor');
  });

  it('returns moderate when violation ratio >= 5% < 15%', () => {
    expect(computeViolationSeverity(5, 100)).toBe('moderate');
    expect(computeViolationSeverity(14, 100)).toBe('moderate');
  });

  it('returns major when violation ratio >= 15% < 30%', () => {
    expect(computeViolationSeverity(15, 100)).toBe('major');
    expect(computeViolationSeverity(29, 100)).toBe('major');
  });

  it('returns critical when violation ratio >= 30%', () => {
    expect(computeViolationSeverity(30, 100)).toBe('critical');
    expect(computeViolationSeverity(50, 100)).toBe('critical');
  });
});

describe('computeComplianceScore', () => {
  it('adds 10 bonus when no violations', () => {
    const withBonus = computeComplianceScore(80, 0, 'minor');
    const withoutBonus = computeComplianceScore(80, 1, 'minor');
    expect(withBonus - withoutBonus).toBe(10);
  });

  it('penalizes critical violations by 20', () => {
    const scoreNormal = computeComplianceScore(80, 1, 'minor');
    const scoreCritical = computeComplianceScore(80, 1, 'critical');
    expect(scoreNormal - scoreCritical).toBe(20);
  });

  it('penalizes major violations by 10', () => {
    const scoreNormal = computeComplianceScore(80, 1, 'minor');
    const scoreMajor = computeComplianceScore(80, 1, 'major');
    expect(scoreNormal - scoreMajor).toBe(10);
  });

  it('clamps to 0-100', () => {
    expect(computeComplianceScore(0, 10, 'critical')).toBe(0);
    expect(computeComplianceScore(100, 0, 'minor')).toBe(100);
  });
});

describe('computeComplianceTier', () => {
  it('exemplary at score >= 90', () => {
    expect(computeComplianceTier(90)).toBe('exemplary');
    expect(computeComplianceTier(100)).toBe('exemplary');
  });

  it('compliant at score >= 70', () => {
    expect(computeComplianceTier(70)).toBe('compliant');
    expect(computeComplianceTier(89)).toBe('compliant');
  });

  it('partial at score >= 45', () => {
    expect(computeComplianceTier(45)).toBe('partial');
    expect(computeComplianceTier(69)).toBe('partial');
  });

  it('defiant at score < 45', () => {
    expect(computeComplianceTier(0)).toBe('defiant');
    expect(computeComplianceTier(44)).toBe('defiant');
  });
});
