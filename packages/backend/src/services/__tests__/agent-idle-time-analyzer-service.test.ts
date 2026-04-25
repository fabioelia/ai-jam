import { describe, it, expect, vi } from 'vitest';
import {
  computeIdleScore,
  getIdleTier,
  analyzeAgentIdleTime,
} from '../agent-idle-time-analyzer-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock idle time summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeIdleScore', () => {
  // Test 1: zero avgIdleGap gives base=70, no streak penalty, latencyBonus=10 → 80
  it('avgIdleGap=0, longestIdleStreak=0, responseLatency=0 → base=70, penalty=0, bonus=10 → 80', () => {
    expect(computeIdleScore(0, 0, 0)).toBe(80);
  });

  // Test 2: avgIdleGap=10 → base = max(0, 100-50)=50, no streak, latency bonus <1 → 60
  it('avgIdleGap=10, streak=0, latency=0.5 → base=50, bonus=10 → 60', () => {
    expect(computeIdleScore(10, 0, 0.5)).toBe(60);
  });

  // Test 3: avgIdleGap=20 → base=max(0,100-100)=0, no streak, latency >=4 no bonus → 0
  it('avgIdleGap=20, streak=0, latency=5 → base=0, bonus=0 → 0', () => {
    expect(computeIdleScore(20, 0, 5)).toBe(0);
  });

  // Test 4: streak penalty: longestIdleStreak=5 → penalty=10
  it('avgIdleGap=5, streak=5, latency=5 → base=max(0,75)=70 but capped, penalty=10, bonus=0 → 60', () => {
    // base = min(max(0, 100-25), 70) = min(75, 70) = 70; penalty = min(10, 20) = 10; bonus=0; → 60
    expect(computeIdleScore(5, 5, 5)).toBe(60);
  });

  // Test 5: streak penalty maxes at 20 (longestIdleStreak=15)
  it('streak penalty capped at 20 when longestIdleStreak>=10', () => {
    // base=70 (avgIdleGap=0), penalty=min(30,20)=20, bonus=10; → 60
    expect(computeIdleScore(0, 15, 0)).toBe(60);
  });

  // Test 6: latencyBonus=5 when responseLatency between 1 and 4
  it('responseLatency=2 gives latencyBonus=5', () => {
    // avgIdleGap=0 → base=70, streak=0, latency=2 → bonus=5 → 75
    expect(computeIdleScore(0, 0, 2)).toBe(75);
  });

  // Test 7: latencyBonus=0 when responseLatency>=4
  it('responseLatency=4 gives latencyBonus=0', () => {
    // avgIdleGap=0 → base=70, streak=0, latency=4 → bonus=0 → 70
    expect(computeIdleScore(0, 0, 4)).toBe(70);
  });

  // Test 8: clamps to 100 max
  it('clamps to 100 max', () => {
    expect(computeIdleScore(0, 0, 0)).toBeLessThanOrEqual(100);
  });

  // Test 9: clamps to 0 min
  it('clamps to 0 min', () => {
    expect(computeIdleScore(100, 100, 100)).toBe(0);
  });
});

describe('getIdleTier', () => {
  // Test 10: highly-active (>= 80)
  it('returns highly-active for score >= 80', () => {
    expect(getIdleTier(80)).toBe('highly-active');
    expect(getIdleTier(100)).toBe('highly-active');
  });

  // Test 11: active (>= 60)
  it('returns active for score >= 60 and < 80', () => {
    expect(getIdleTier(60)).toBe('active');
    expect(getIdleTier(79)).toBe('active');
  });

  // Test 12: periodic (>= 40)
  it('returns periodic for score >= 40 and < 60', () => {
    expect(getIdleTier(40)).toBe('periodic');
    expect(getIdleTier(59)).toBe('periodic');
  });

  // Test 13: dormant (< 40)
  it('returns dormant for score < 40', () => {
    expect(getIdleTier(39)).toBe('dormant');
    expect(getIdleTier(0)).toBe('dormant');
  });
});

describe('analyzeAgentIdleTime', () => {
  // Test 14: returns correct report shape
  it('returns correct report shape with mock data', async () => {
    const report = await analyzeAgentIdleTime('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  // Test 15: summary fields populated correctly
  it('summary fields populated correctly', async () => {
    const report = await analyzeAgentIdleTime('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgProjectIdleGap).toBe('number');
    expect(typeof report.summary.mostActive).toBe('string');
    expect(typeof report.summary.highlyActiveCount).toBe('number');
  });

  // Test 16: agents have correct structure
  it('each agent has required fields', async () => {
    const report = await analyzeAgentIdleTime('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalIdleTime');
    expect(agent).toHaveProperty('avgIdleGap');
    expect(agent).toHaveProperty('longestIdleStreak');
    expect(agent).toHaveProperty('responseLatency');
    expect(agent).toHaveProperty('idleScore');
    expect(agent).toHaveProperty('idleTier');
  });
});
