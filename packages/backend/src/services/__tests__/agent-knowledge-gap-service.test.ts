import { describe, it, expect } from 'vitest';

// Test pure gap severity computation logic (extracted for testing)
function computeGapSeverity(unassignedCount: number, agentCount: number, demand: number): 'critical' | 'moderate' | 'none' {
  if (unassignedCount >= 3 || (agentCount === 0 && demand > 0)) return 'critical';
  if (unassignedCount >= 1 && unassignedCount <= 2) return 'moderate';
  return 'none';
}

describe('knowledge gap severity', () => {
  it('gapSeverity critical when 3+ unassigned tickets', () => {
    expect(computeGapSeverity(3, 0, 3)).toBe('critical');
    expect(computeGapSeverity(5, 1, 5)).toBe('critical');
  });

  it('gapSeverity moderate for 1 unassigned', () => {
    expect(computeGapSeverity(1, 1, 2)).toBe('moderate');
  });

  it('gapSeverity moderate for 2 unassigned', () => {
    expect(computeGapSeverity(2, 1, 3)).toBe('moderate');
  });

  it('gapSeverity none when all assigned', () => {
    expect(computeGapSeverity(0, 2, 2)).toBe('none');
  });

  it('gapSeverity critical when no agents and demand > 0', () => {
    expect(computeGapSeverity(0, 0, 5)).toBe('critical');
  });
});

// Domain detection logic
function detectDomain(title: string, description = ''): string {
  const text = (title + ' ' + description).toLowerCase();
  if (/api|database|sql|server|endpoint/.test(text)) return 'backend';
  if (/ui|react|component|css|modal|page/.test(text)) return 'frontend';
  if (/test|qa|spec|e2e/.test(text)) return 'testing';
  if (/deploy|ci|pipeline|docker|build/.test(text)) return 'devops';
  if (/analyze|report|metrics|stats/.test(text)) return 'analysis';
  return 'general';
}

describe('domain detection', () => {
  it('detects backend domain from api keyword', () => {
    expect(detectDomain('Build REST API endpoint')).toBe('backend');
  });

  it('detects frontend domain from react keyword', () => {
    expect(detectDomain('Create React component')).toBe('frontend');
  });

  it('detects testing domain from test keyword', () => {
    expect(detectDomain('Write unit tests')).toBe('testing');
  });

  it('returns general for unmatched keywords', () => {
    expect(detectDomain('Do the thing')).toBe('general');
  });
});
