import { describe, it, expect, vi } from 'vitest';
import {
  computeResponseScore,
  getResponseTier,
  analyzeAgentResponseTimeEfficiency,
} from '../agent-response-time-efficiency-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response time summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeResponseScore', () => {
  // Test 1: fastResponseRate=1.0, avgResponseTime<0.5, queueDepth=0 → base=60, bonus=30, penalty=0 → 90
  it('fastResponseRate=1.0, avgResponseTime=0.3, queueDepth=0 → 90', () => {
    expect(computeResponseScore(1.0, 0.3, 0)).toBe(90);
  });

  // Test 2: fastResponseRate=0.5, avgResponseTime>=0.5 and <1, queueDepth=0 → base=30, bonus=20 → 50
  it('fastResponseRate=0.5, avgResponseTime=0.7, queueDepth=0 → 50', () => {
    expect(computeResponseScore(0.5, 0.7, 0)).toBe(50);
  });

  // Test 3: avgBonus=10 when avgResponseTime between 1 and 2
  it('avgBonus=10 when avgResponseTime=1.5', () => {
    // base = 0.5*60=30, bonus=10, penalty=0 → 40
    expect(computeResponseScore(0.5, 1.5, 0)).toBe(40);
  });

  // Test 4: avgBonus=0 when avgResponseTime>=2
  it('avgBonus=0 when avgResponseTime=3', () => {
    // base = 0.5*60=30, bonus=0, penalty=0 → 30
    expect(computeResponseScore(0.5, 3, 0)).toBe(30);
  });

  // Test 5: queuePenalty = queueDepth*5, capped at 20
  it('queuePenalty=10 when queueDepth=2', () => {
    // base=60, bonus=30, penalty=10 → 80
    expect(computeResponseScore(1.0, 0.3, 2)).toBe(80);
  });

  // Test 6: queuePenalty capped at 20 when queueDepth>=4
  it('queuePenalty capped at 20 when queueDepth=5', () => {
    // base=60, bonus=30, penalty=20 → 70
    expect(computeResponseScore(1.0, 0.3, 5)).toBe(70);
  });

  // Test 7: clamps to 100 max
  it('clamps to 100 max', () => {
    expect(computeResponseScore(1.0, 0.0, 0)).toBeLessThanOrEqual(100);
  });

  // Test 8: clamps to 0 min
  it('clamps to 0 min', () => {
    expect(computeResponseScore(0, 10, 10)).toBe(0);
  });

  // Test 9: fractional fastResponseRate
  it('fastResponseRate=0.8, avgResponseTime=0.4, queueDepth=0 → base=48, bonus=30 → 78', () => {
    expect(computeResponseScore(0.8, 0.4, 0)).toBe(78);
  });
});

describe('getResponseTier', () => {
  // Test 10: lightning (>= 80)
  it('returns lightning for score >= 80', () => {
    expect(getResponseTier(80)).toBe('lightning');
    expect(getResponseTier(100)).toBe('lightning');
  });

  // Test 11: responsive (>= 60)
  it('returns responsive for score >= 60 and < 80', () => {
    expect(getResponseTier(60)).toBe('responsive');
    expect(getResponseTier(79)).toBe('responsive');
  });

  // Test 12: moderate (>= 40)
  it('returns moderate for score >= 40 and < 60', () => {
    expect(getResponseTier(40)).toBe('moderate');
    expect(getResponseTier(59)).toBe('moderate');
  });

  // Test 13: sluggish (< 40)
  it('returns sluggish for score < 40', () => {
    expect(getResponseTier(39)).toBe('sluggish');
    expect(getResponseTier(0)).toBe('sluggish');
  });
});

describe('analyzeAgentResponseTimeEfficiency', () => {
  // Test 14: returns correct report shape
  it('returns correct report shape with mock data', async () => {
    const report = await analyzeAgentResponseTimeEfficiency('project-1');
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
    const report = await analyzeAgentResponseTimeEfficiency('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgResponseScore).toBe('number');
    expect(typeof report.summary.fastestAgent).toBe('string');
    expect(typeof report.summary.lightningCount).toBe('number');
  });

  // Test 16: each agent has required fields
  it('each agent has required fields', async () => {
    const report = await analyzeAgentResponseTimeEfficiency('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalTasksReceived');
    expect(agent).toHaveProperty('avgResponseTime');
    expect(agent).toHaveProperty('fastResponseRate');
    expect(agent).toHaveProperty('queueDepth');
    expect(agent).toHaveProperty('timeToFirstAction');
    expect(agent).toHaveProperty('responseScore');
    expect(agent).toHaveProperty('responseTier');
  });
});
