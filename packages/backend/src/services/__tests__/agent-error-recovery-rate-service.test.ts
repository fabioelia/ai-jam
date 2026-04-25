import { describe, it, expect, vi } from 'vitest';
import {
  computeRecoveryScore,
  getRecoveryTier,
  analyzeAgentErrorRecoveryRate,
} from '../agent-error-recovery-rate-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock error recovery summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeRecoveryScore', () => {
  // Test 1: retrySuccessRate=1.0, avgRecoveryTime<1, cascadeDepth=0 → base=60, timeBonus=30, penalty=0 → 90
  it('retrySuccessRate=1.0, avgRecoveryTime=0.5, cascadeDepth=0 → 90', () => {
    expect(computeRecoveryScore(1.0, 0.5, 0)).toBe(90);
  });

  // Test 2: retrySuccessRate=0.5, avgRecoveryTime between 1 and 4 → base=30, timeBonus=20, penalty=0 → 50
  it('retrySuccessRate=0.5, avgRecoveryTime=2, cascadeDepth=0 → 50', () => {
    expect(computeRecoveryScore(0.5, 2, 0)).toBe(50);
  });

  // Test 3: timeBonus=10 when avgRecoveryTime between 4 and 8
  it('timeBonus=10 when avgRecoveryTime=6', () => {
    // base=30, timeBonus=10, penalty=0 → 40
    expect(computeRecoveryScore(0.5, 6, 0)).toBe(40);
  });

  // Test 4: timeBonus=0 when avgRecoveryTime>=8
  it('timeBonus=0 when avgRecoveryTime=10', () => {
    // base=30, timeBonus=0, penalty=0 → 30
    expect(computeRecoveryScore(0.5, 10, 0)).toBe(30);
  });

  // Test 5: cascadePenalty=10 when failureCascadeDepth=2
  it('cascadePenalty=10 when failureCascadeDepth=2', () => {
    // base=60, timeBonus=30, penalty=10 → 80
    expect(computeRecoveryScore(1.0, 0.5, 2)).toBe(80);
  });

  // Test 6: cascadePenalty capped at 20 when failureCascadeDepth>=4
  it('cascadePenalty capped at 20 when failureCascadeDepth=5', () => {
    // base=60, timeBonus=30, penalty=20 → 70
    expect(computeRecoveryScore(1.0, 0.5, 5)).toBe(70);
  });

  // Test 7: clamps to 100 max
  it('clamps to 100 max', () => {
    expect(computeRecoveryScore(1.0, 0, 0)).toBeLessThanOrEqual(100);
  });

  // Test 8: clamps to 0 min
  it('clamps to 0 min', () => {
    expect(computeRecoveryScore(0, 100, 100)).toBe(0);
  });

  // Test 9: fractional retrySuccessRate
  it('retrySuccessRate=0.8, avgRecoveryTime=0.5, cascadeDepth=0 → base=48, timeBonus=30 → 78', () => {
    expect(computeRecoveryScore(0.8, 0.5, 0)).toBe(78);
  });
});

describe('getRecoveryTier', () => {
  // Test 10: resilient (>= 80)
  it('returns resilient for score >= 80', () => {
    expect(getRecoveryTier(80)).toBe('resilient');
    expect(getRecoveryTier(100)).toBe('resilient');
  });

  // Test 11: recovering (>= 60)
  it('returns recovering for score >= 60 and < 80', () => {
    expect(getRecoveryTier(60)).toBe('recovering');
    expect(getRecoveryTier(79)).toBe('recovering');
  });

  // Test 12: struggling (>= 40)
  it('returns struggling for score >= 40 and < 60', () => {
    expect(getRecoveryTier(40)).toBe('struggling');
    expect(getRecoveryTier(59)).toBe('struggling');
  });

  // Test 13: critical (< 40)
  it('returns critical for score < 40', () => {
    expect(getRecoveryTier(39)).toBe('critical');
    expect(getRecoveryTier(0)).toBe('critical');
  });
});

describe('analyzeAgentErrorRecoveryRate', () => {
  // Test 14: returns correct report shape
  it('returns correct report shape with mock data', async () => {
    const report = await analyzeAgentErrorRecoveryRate('project-1');
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
    const report = await analyzeAgentErrorRecoveryRate('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgRecoveryScore).toBe('number');
    expect(typeof report.summary.fastestRecoverer).toBe('string');
    expect(typeof report.summary.resilientCount).toBe('number');
  });

  // Test 16: each agent has required fields
  it('each agent has required fields', async () => {
    const report = await analyzeAgentErrorRecoveryRate('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalErrors');
    expect(agent).toHaveProperty('retrySuccessRate');
    expect(agent).toHaveProperty('avgRecoveryTime');
    expect(agent).toHaveProperty('failureCascadeDepth');
    expect(agent).toHaveProperty('firstAttemptSuccessRate');
    expect(agent).toHaveProperty('recoveryScore');
    expect(agent).toHaveProperty('recoveryTier');
  });
});
