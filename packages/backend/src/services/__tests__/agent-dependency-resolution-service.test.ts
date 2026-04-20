import { describe, it, expect } from 'vitest';
import {
  computeDependencyResolutionRate,
  computeRiskLevel,
  detectCircularDependencies,
  findLongestBlockChain,
} from '../agent-dependency-resolution-service.js';

describe('computeDependencyResolutionRate', () => {
  it('returns 0 for empty project (no dependencies)', () => {
    expect(computeDependencyResolutionRate(0, 0)).toBe(0);
  });

  it('returns 50 when 1 of 2 dependencies resolved', () => {
    expect(computeDependencyResolutionRate(1, 2)).toBe(50);
  });

  it('returns 100 when all resolved', () => {
    expect(computeDependencyResolutionRate(3, 3)).toBe(100);
  });
});

describe('computeRiskLevel', () => {
  it('returns critical at 72 hours', () => {
    expect(computeRiskLevel(72)).toBe('critical');
  });

  it('returns high at 48 hours', () => {
    expect(computeRiskLevel(48)).toBe('high');
  });

  it('returns medium at 24 hours', () => {
    expect(computeRiskLevel(24)).toBe('medium');
  });

  it('returns low at 23 hours', () => {
    expect(computeRiskLevel(23)).toBe('low');
  });
});

describe('detectCircularDependencies', () => {
  it('detects A->B->C->A cycle', () => {
    const deps = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);
    const cycles = detectCircularDependencies(deps);
    expect(cycles.length).toBeGreaterThan(0);
    const cycleFlat = cycles.flat();
    expect(cycleFlat).toContain('A');
    expect(cycleFlat).toContain('B');
    expect(cycleFlat).toContain('C');
  });

  it('returns empty for no cycles', () => {
    const deps = new Map([
      ['A', ['B']],
      ['B', ['C']],
    ]);
    const cycles = detectCircularDependencies(deps);
    expect(cycles.length).toBe(0);
  });
});

describe('findLongestBlockChain', () => {
  it('returns 3 for A->B->C chain', () => {
    const deps = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', []],
    ]);
    expect(findLongestBlockChain(deps)).toBe(3);
  });

  it('returns 0 for empty deps', () => {
    expect(findLongestBlockChain(new Map())).toBe(0);
  });
});
