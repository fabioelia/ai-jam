import { describe, it, expect, vi } from 'vitest';
import {
  computeEstimatedCost,
  computeEfficiencyScore,
  getEfficiencyTier,
  analyzeAgentTokenCostEfficiency,
} from '../agent-token-cost-efficiency-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock token cost summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeEstimatedCost', () => {
  it('calculates cost correctly for typical values', () => {
    // 45000 * 0.000003 + 12000 * 0.000015 = 0.135 + 0.18 = 0.315
    expect(computeEstimatedCost(45000, 12000)).toBe(0.315);
  });

  it('returns 0 for zero tokens', () => {
    expect(computeEstimatedCost(0, 0)).toBe(0);
  });

  it('rounds to 6 decimal places', () => {
    const result = computeEstimatedCost(1, 1);
    // 0.000003 + 0.000015 = 0.000018
    expect(result).toBe(0.000018);
  });

  it('handles only input tokens', () => {
    expect(computeEstimatedCost(1000, 0)).toBe(0.003);
  });

  it('handles only output tokens', () => {
    expect(computeEstimatedCost(0, 1000)).toBe(0.015);
  });
});

describe('computeEfficiencyScore', () => {
  it('returns 0 for zero tickets completed', () => {
    expect(computeEfficiencyScore(5000, 0.1, 0)).toBe(0);
  });

  it('applies volume bonus of 10 for >= 10 tickets', () => {
    // tokensPerTicket=0 → baseScore=100, volumeBonus=10 → clamped 100
    expect(computeEfficiencyScore(0, 0, 10)).toBe(100);
  });

  it('applies volume bonus of 5 for >= 5 tickets', () => {
    // tokensPerTicket=5000 → baseScore=clamp(100-10,0,100)=90, volumeBonus=5 → 95
    expect(computeEfficiencyScore(5000, 0.1, 5)).toBe(95);
  });

  it('applies no volume bonus for < 5 tickets', () => {
    // tokensPerTicket=5000 → baseScore=90, volumeBonus=0 → 90
    expect(computeEfficiencyScore(5000, 0.1, 4)).toBe(90);
  });

  it('clamps score at 100', () => {
    expect(computeEfficiencyScore(0, 0, 20)).toBe(100);
  });

  it('clamps score at 0 for very high tokensPerTicket', () => {
    // tokensPerTicket=100000 → baseScore = clamp(100-200,0,100) = 0
    expect(computeEfficiencyScore(100000, 0.5, 1)).toBe(0);
  });

  it('baseScore reduces correctly with tokensPerTicket', () => {
    // tokensPerTicket=10000 → baseScore = clamp(100-20, 0, 100) = 80
    // ticketsCompleted=3 < 5 → volumeBonus=0 → score=80
    expect(computeEfficiencyScore(10000, 0.2, 3)).toBe(80);
  });
});

describe('getEfficiencyTier', () => {
  it('returns optimal for score >= 80', () => {
    expect(getEfficiencyTier(80)).toBe('optimal');
    expect(getEfficiencyTier(100)).toBe('optimal');
  });

  it('returns efficient for score >= 60 and < 80', () => {
    expect(getEfficiencyTier(60)).toBe('efficient');
    expect(getEfficiencyTier(79)).toBe('efficient');
  });

  it('returns moderate for score >= 40 and < 60', () => {
    expect(getEfficiencyTier(40)).toBe('moderate');
    expect(getEfficiencyTier(59)).toBe('moderate');
  });

  it('returns expensive for score < 40', () => {
    expect(getEfficiencyTier(39)).toBe('expensive');
    expect(getEfficiencyTier(0)).toBe('expensive');
  });
});

describe('analyzeAgentTokenCostEfficiency', () => {
  it('returns correct report shape', async () => {
    const report = await analyzeAgentTokenCostEfficiency('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('summary fields populated correctly', async () => {
    const report = await analyzeAgentTokenCostEfficiency('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.totalTokensIn).toBe('number');
    expect(typeof report.summary.totalTokensOut).toBe('number');
    expect(typeof report.summary.totalEstimatedCost).toBe('number');
    expect(typeof report.summary.avgEfficiencyScore).toBe('number');
  });

  it('agents array is non-empty with required fields', async () => {
    const report = await analyzeAgentTokenCostEfficiency('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalSessions');
    expect(agent).toHaveProperty('totalTokensIn');
    expect(agent).toHaveProperty('totalTokensOut');
    expect(agent).toHaveProperty('totalTokens');
    expect(agent).toHaveProperty('estimatedCostUsd');
    expect(agent).toHaveProperty('ticketsCompleted');
    expect(agent).toHaveProperty('costPerTicket');
    expect(agent).toHaveProperty('tokensPerTicket');
    expect(agent).toHaveProperty('efficiencyScore');
    expect(agent).toHaveProperty('efficiencyTier');
  });
});
