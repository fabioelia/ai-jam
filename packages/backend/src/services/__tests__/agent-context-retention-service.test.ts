import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeContextRetentionScore,
  getRetentionTier,
  analyzeAgentContextRetention,
} from '../agent-context-retention-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock context retention summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeContextRetentionScore', () => {
  // Test 1: base formula only (no volume bonus)
  it('base formula only: contextReferenceRate=60, coherence=0, handoffs=0 → base=30, coherenceBonus=0, volumeBonus=0 → 30', () => {
    expect(computeContextRetentionScore(60, 0, 0)).toBe(30);
  });

  // Test 2: with coherenceBonus
  it('with coherenceBonus: contextReferenceRate=60, coherence=50, handoffs=0 → base=30, coherenceBonus=20 → 50', () => {
    expect(computeContextRetentionScore(60, 50, 0)).toBe(50);
  });

  // Test 3: volumeBonus at 10 handoffs (+5)
  it('volumeBonus=5 when totalHandoffsReceived=10: rate=60, coherence=50, handoffs=10 → 30+20+5=55', () => {
    expect(computeContextRetentionScore(60, 50, 10)).toBe(55);
  });

  // Test 4: volumeBonus at 20 handoffs (+10)
  it('volumeBonus=10 when totalHandoffsReceived=20: rate=60, coherence=50, handoffs=20 → 30+20+10=60', () => {
    expect(computeContextRetentionScore(60, 50, 20)).toBe(60);
  });

  // Test 5: clamps at 100
  it('clamps to 100 max', () => {
    expect(computeContextRetentionScore(100, 100, 25)).toBe(100);
  });

  // Test 6: clamps at 0
  it('clamps to 0 min', () => {
    expect(computeContextRetentionScore(0, 0, 0)).toBe(0);
  });
});

describe('getRetentionTier', () => {
  // Test 7: exemplary (>= 80)
  it('returns exemplary for score >= 80', () => {
    expect(getRetentionTier(80)).toBe('exemplary');
    expect(getRetentionTier(100)).toBe('exemplary');
  });

  // Test 8: proficient (>= 60)
  it('returns proficient for score >= 60 and < 80', () => {
    expect(getRetentionTier(60)).toBe('proficient');
    expect(getRetentionTier(79)).toBe('proficient');
  });

  // Test 9: adequate (>= 40)
  it('returns adequate for score >= 40 and < 60', () => {
    expect(getRetentionTier(40)).toBe('adequate');
    expect(getRetentionTier(59)).toBe('adequate');
  });

  // Test 10: fragmented (< 40)
  it('returns fragmented for score < 40', () => {
    expect(getRetentionTier(39)).toBe('fragmented');
    expect(getRetentionTier(0)).toBe('fragmented');
  });
});

describe('analyzeAgentContextRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 11: returns correct report shape
  it('returns correct report shape with no sessions (mock data fallback)', async () => {
    const report = await analyzeAgentContextRetention('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  // Test 12: summary fields populated correctly
  it('summary fields populated correctly', async () => {
    const report = await analyzeAgentContextRetention('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgRetentionScore).toBe('number');
    expect(typeof report.summary.topContextUser).toBe('string');
    expect(typeof report.summary.exemplaryCount).toBe('number');
  });
});
