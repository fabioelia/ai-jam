import { describe, it, expect } from 'vitest';
import {
  computeSpecializationScore,
  getSpecializationTier,
  getSpecializationTierLabel,
  formatRatio,
} from '../agent-specialization-index-service.js';

describe('computeSpecializationScore', () => {
  it('returns 0 when totalTickets < 3', () => {
    expect(computeSpecializationScore(0, 1, 0.9)).toBe(0);
    expect(computeSpecializationScore(2, 1, 0.9)).toBe(0);
  });

  it('computes specialist case correctly', () => {
    // (10, 1, 0.9): 0.9*60=54, max(0,20-4)=16, min(20,20)=20 → 90
    expect(computeSpecializationScore(10, 1, 0.9)).toBe(90);
  });

  it('computes balanced case correctly', () => {
    // (5, 3, 0.6): 0.6*60=36, max(0,20-12)=8, min(20,10)=10 → 54
    expect(computeSpecializationScore(5, 3, 0.6)).toBe(54);
  });

  it('computes generalist case correctly', () => {
    // (4, 6, 0.3): 0.3*60=18, max(0,20-24)=0, min(20,8)=8 → 26
    expect(computeSpecializationScore(4, 6, 0.3)).toBe(26);
  });

  it('reaches max score of 100', () => {
    // (10, 0, 1.0): 60 + max(0,20-0)=20 + min(20,20)=20 → 100
    expect(computeSpecializationScore(10, 0, 1.0)).toBe(100);
  });

  it('produces low score for generalist with few tickets', () => {
    // (3, 100, 0): 0 + max(0,20-400)=0 + min(20,6)=6 → 6
    expect(computeSpecializationScore(3, 100, 0)).toBe(6);
  });

  it('handles all same epic (dominantEpicRatio=1, uniqueEpics=1)', () => {
    // (5, 1, 1.0): 60 + 16 + min(20,10)=10 → 86
    expect(computeSpecializationScore(5, 1, 1.0)).toBe(86);
  });
});

describe('getSpecializationTier', () => {
  it('returns insufficient_data when totalTickets < 3', () => {
    expect(getSpecializationTier(90, 2)).toBe('insufficient_data');
    expect(getSpecializationTier(90, 0)).toBe('insufficient_data');
  });

  it('returns specialist when score >= 70', () => {
    expect(getSpecializationTier(70, 5)).toBe('specialist');
    expect(getSpecializationTier(100, 5)).toBe('specialist');
  });

  it('returns balanced when score >= 40', () => {
    expect(getSpecializationTier(40, 5)).toBe('balanced');
    expect(getSpecializationTier(69, 5)).toBe('balanced');
  });

  it('returns generalist when score < 40', () => {
    expect(getSpecializationTier(39, 5)).toBe('generalist');
    expect(getSpecializationTier(0, 5)).toBe('generalist');
  });
});

describe('getSpecializationTierLabel', () => {
  it('returns correct label for specialist', () => {
    expect(getSpecializationTierLabel('specialist')).toBe('Specialist');
  });

  it('returns correct label for balanced', () => {
    expect(getSpecializationTierLabel('balanced')).toBe('Balanced');
  });

  it('returns correct label for generalist', () => {
    expect(getSpecializationTierLabel('generalist')).toBe('Generalist');
  });

  it('returns correct label for insufficient_data', () => {
    expect(getSpecializationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatRatio', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatRatio(0)).toBe('0.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatRatio(0.5)).toBe('50.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatRatio(1)).toBe('100.0%');
  });
});
