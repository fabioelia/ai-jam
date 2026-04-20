import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeThroughputScore, getThroughputTier, analyzeAgentThroughput } from '../agent-throughput-service.js';

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
        content: [{ type: 'text', text: 'Mock summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeThroughputScore', () => {
  it('base formula: avg=3, peak=5, total=10 → base=30, peakBonus=4, volumeBonus=0 → 34', () => {
    expect(computeThroughputScore(3, 5, 10)).toBe(34);
  });

  it('peakBonus capped at 20', () => {
    // avg=1, peak=20, total=10 → base=10, peakBonus=min(38,20)=20, vol=0 → 30
    expect(computeThroughputScore(1, 20, 10)).toBe(30);
  });

  it('base capped at 70', () => {
    // avg=10, peak=12, total=10 → base=70, peakBonus=4, vol=0 → 74
    expect(computeThroughputScore(10, 12, 10)).toBe(74);
  });

  it('volumeBonus=5 when totalTasksCompleted>=20', () => {
    // avg=2, peak=3, total=25 → base=20, peakBonus=2, vol=5 → 27
    expect(computeThroughputScore(2, 3, 25)).toBe(27);
  });

  it('volumeBonus=10 when totalTasksCompleted>=50', () => {
    // avg=2, peak=3, total=55 → base=20, peakBonus=2, vol=10 → 32
    expect(computeThroughputScore(2, 3, 55)).toBe(32);
  });

  it('clamps to 100', () => {
    expect(computeThroughputScore(10, 20, 60)).toBe(100);
  });

  it('clamps to 0', () => {
    expect(computeThroughputScore(0, 0, 0)).toBe(0);
  });
});

describe('getThroughputTier', () => {
  it('>=80 → high-velocity', () => {
    expect(getThroughputTier(80)).toBe('high-velocity');
    expect(getThroughputTier(95)).toBe('high-velocity');
  });

  it('>=60 and <80 → steady', () => {
    expect(getThroughputTier(60)).toBe('steady');
    expect(getThroughputTier(79)).toBe('steady');
  });

  it('>=40 and <60 → moderate', () => {
    expect(getThroughputTier(40)).toBe('moderate');
    expect(getThroughputTier(59)).toBe('moderate');
  });

  it('<40 → low-output', () => {
    expect(getThroughputTier(39)).toBe('low-output');
    expect(getThroughputTier(0)).toBe('low-output');
  });
});

describe('analyzeAgentThroughput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns report shape with no sessions (mock data fallback)', async () => {
    const report = await analyzeAgentThroughput('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('summary fields populated', async () => {
    const report = await analyzeAgentThroughput('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgProjectThroughput).toBe('number');
    expect(typeof report.summary.topPerformer).toBe('string');
    expect(typeof report.summary.highVelocityCount).toBe('number');
  });
});
