import { describe, it, expect, vi } from 'vitest';
import {
  computeWorkloadScore,
  getWorkloadTier,
  analyzeAgentWorkloadBalance,
} from '../agent-workload-balance-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock workload balance summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeWorkloadScore', () => {
  // Test 1: utilizationRate=1.0, variance<1, avgTasks>=5 → base=60, varianceBonus=30, volumeBonus=10 → 100
  it('utilizationRate=1.0, variance=0.5, avgTasks=5 → 100', () => {
    expect(computeWorkloadScore(1.0, 0.5, 5)).toBe(100);
  });

  // Test 2: utilizationRate=0.5, variance<1, avgTasks<2 → base=30, varianceBonus=30, volumeBonus=0 → 60
  it('utilizationRate=0.5, variance=0.5, avgTasks=1 → 60', () => {
    expect(computeWorkloadScore(0.5, 0.5, 1)).toBe(60);
  });

  // Test 3: varianceBonus=20 when workloadVariance between 1 and 3
  it('varianceBonus=20 when variance=2', () => {
    // base=30, varianceBonus=20, volumeBonus=0 → 50
    expect(computeWorkloadScore(0.5, 2, 1)).toBe(50);
  });

  // Test 4: varianceBonus=10 when workloadVariance between 3 and 6
  it('varianceBonus=10 when variance=4', () => {
    // base=30, varianceBonus=10, volumeBonus=0 → 40
    expect(computeWorkloadScore(0.5, 4, 1)).toBe(40);
  });

  // Test 5: varianceBonus=0 when workloadVariance>=6
  it('varianceBonus=0 when variance=7', () => {
    // base=30, varianceBonus=0, volumeBonus=0 → 30
    expect(computeWorkloadScore(0.5, 7, 1)).toBe(30);
  });

  // Test 6: volumeBonus=5 when avgTasksPerSession>=2 and <5
  it('volumeBonus=5 when avgTasks=3', () => {
    // base=30, varianceBonus=30, volumeBonus=5 → 65
    expect(computeWorkloadScore(0.5, 0.5, 3)).toBe(65);
  });

  // Test 7: volumeBonus=10 when avgTasksPerSession>=5
  it('volumeBonus=10 when avgTasks=6', () => {
    // base=30, varianceBonus=30, volumeBonus=10 → 70
    expect(computeWorkloadScore(0.5, 0.5, 6)).toBe(70);
  });

  // Test 8: clamps to 100 max
  it('clamps to 100 max', () => {
    expect(computeWorkloadScore(2.0, 0, 10)).toBeLessThanOrEqual(100);
  });

  // Test 9: clamps to 0 min
  it('clamps to 0 min', () => {
    expect(computeWorkloadScore(0, 100, 0)).toBe(0);
  });

  // Test 10: base is capped at 60 even when utilizationRate > 1
  it('base capped at 60 when utilizationRate=2', () => {
    // base=60 (capped), varianceBonus=30, volumeBonus=10 → 100
    expect(computeWorkloadScore(2.0, 0.5, 5)).toBe(100);
  });
});

describe('getWorkloadTier', () => {
  // Test 11: balanced (>= 80)
  it('returns balanced for score >= 80', () => {
    expect(getWorkloadTier(80)).toBe('balanced');
    expect(getWorkloadTier(100)).toBe('balanced');
  });

  // Test 12: overloaded (>= 60)
  it('returns overloaded for score >= 60 and < 80', () => {
    expect(getWorkloadTier(60)).toBe('overloaded');
    expect(getWorkloadTier(79)).toBe('overloaded');
  });

  // Test 13: underutilized (>= 40)
  it('returns underutilized for score >= 40 and < 60', () => {
    expect(getWorkloadTier(40)).toBe('underutilized');
    expect(getWorkloadTier(59)).toBe('underutilized');
  });

  // Test 14: idle (< 40)
  it('returns idle for score < 40', () => {
    expect(getWorkloadTier(39)).toBe('idle');
    expect(getWorkloadTier(0)).toBe('idle');
  });
});

describe('analyzeAgentWorkloadBalance', () => {
  // Test 15: returns correct report shape
  it('returns correct report shape with mock data', async () => {
    const report = await analyzeAgentWorkloadBalance('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  // Test 16: summary fields populated correctly
  it('summary fields populated correctly', async () => {
    const report = await analyzeAgentWorkloadBalance('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgWorkloadScore).toBe('number');
    expect(typeof report.summary.mostLoaded).toBe('string');
    expect(typeof report.summary.balancedCount).toBe('number');
  });

  // Test 17: each agent has required fields
  it('each agent has required fields', async () => {
    const report = await analyzeAgentWorkloadBalance('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalTasksAssigned');
    expect(agent).toHaveProperty('avgTasksPerSession');
    expect(agent).toHaveProperty('peakWorkloadSession');
    expect(agent).toHaveProperty('workloadVariance');
    expect(agent).toHaveProperty('utilizationRate');
    expect(agent).toHaveProperty('workloadScore');
    expect(agent).toHaveProperty('workloadTier');
  });
});
