import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentPromptSensitivity,
  computeSensitivityScore,
  computeRobustnessScore,
  getSensitivityLevel,
} from '../agent-prompt-sensitivity-analyzer-service.js';

vi.mock('anthropic', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Prompt sensitivity analysis complete.' }],
      }),
    };
  },
}));

describe('computeSensitivityScore', () => {
  it('returns 0 when zero responses', () => {
    expect(computeSensitivityScore(0, 0)).toBe(0);
  });

  it('returns 0 when no high-variance responses', () => {
    expect(computeSensitivityScore(10, 0)).toBe(0);
  });

  it('returns 100 when all responses are high-variance', () => {
    expect(computeSensitivityScore(10, 10)).toBe(100);
  });

  it('returns 20 for 2 high-variance in 10 responses', () => {
    expect(computeSensitivityScore(10, 2)).toBe(20);
  });

  it('clamps at 100 for over 100% variance', () => {
    expect(computeSensitivityScore(5, 10)).toBe(100);
  });
});

describe('computeRobustnessScore', () => {
  it('returns 100 when sensitivity is 0', () => {
    expect(computeRobustnessScore(0)).toBe(100);
  });

  it('returns 0 when sensitivity is 100', () => {
    expect(computeRobustnessScore(100)).toBe(0);
  });

  it('returns 70 when sensitivity is 30', () => {
    expect(computeRobustnessScore(30)).toBe(70);
  });
});

describe('getSensitivityLevel', () => {
  it('returns robust for score <= 10', () => {
    expect(getSensitivityLevel(5)).toBe('robust');
    expect(getSensitivityLevel(10)).toBe('robust');
  });

  it('returns moderate for score 11-30', () => {
    expect(getSensitivityLevel(20)).toBe('moderate');
    expect(getSensitivityLevel(30)).toBe('moderate');
  });

  it('returns sensitive for score 31-60', () => {
    expect(getSensitivityLevel(45)).toBe('sensitive');
    expect(getSensitivityLevel(60)).toBe('sensitive');
  });

  it('returns highly_sensitive for score > 60', () => {
    expect(getSensitivityLevel(75)).toBe('highly_sensitive');
    expect(getSensitivityLevel(100)).toBe('highly_sensitive');
  });
});

describe('analyzeAgentPromptSensitivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid report shape', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(report).toHaveProperty('sensitivityScore');
    expect(report).toHaveProperty('totalResponses');
    expect(report).toHaveProperty('highVarianceRate');
    expect(report).toHaveProperty('ambiguityFailureRate');
    expect(report).toHaveProperty('robustnessScore');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('mostRobustAgent');
    expect(report).toHaveProperty('mostSensitiveAgent');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('sensitivityScore is in 0-100', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(report.sensitivityScore).toBeGreaterThanOrEqual(0);
    expect(report.sensitivityScore).toBeLessThanOrEqual(100);
  });

  it('robustnessScore is in 0-100', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(report.robustnessScore).toBeGreaterThanOrEqual(0);
    expect(report.robustnessScore).toBeLessThanOrEqual(100);
  });

  it('agents array is non-empty', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(report.agents.length).toBeGreaterThan(0);
  });

  it('each agent has required fields', async () => {
    const report = await analyzeAgentPromptSensitivity();
    for (const agent of report.agents) {
      expect(agent).toHaveProperty('agentId');
      expect(agent).toHaveProperty('agentName');
      expect(agent).toHaveProperty('totalResponses');
      expect(agent).toHaveProperty('highVarianceResponses');
      expect(agent).toHaveProperty('ambiguityFailures');
      expect(agent).toHaveProperty('robustResponses');
      expect(agent).toHaveProperty('sensitivityScore');
      expect(agent).toHaveProperty('robustnessScore');
      expect(agent).toHaveProperty('trend');
      expect(agent).toHaveProperty('sensitivityLevel');
    }
  });

  it('highVarianceRate is a percentage', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(report.highVarianceRate).toBeGreaterThanOrEqual(0);
    expect(report.highVarianceRate).toBeLessThanOrEqual(100);
  });

  it('ambiguityFailureRate is a percentage', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(report.ambiguityFailureRate).toBeGreaterThanOrEqual(0);
    expect(report.ambiguityFailureRate).toBeLessThanOrEqual(100);
  });

  it('totalResponses equals sum of agent responses', async () => {
    const report = await analyzeAgentPromptSensitivity();
    const sum = report.agents.reduce((s, a) => s + a.totalResponses, 0);
    expect(report.totalResponses).toBe(sum);
  });

  it('mostRobustAgent is a non-empty string', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(typeof report.mostRobustAgent).toBe('string');
    expect(report.mostRobustAgent.length).toBeGreaterThan(0);
  });

  it('mostSensitiveAgent is a non-empty string', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(typeof report.mostSensitiveAgent).toBe('string');
    expect(report.mostSensitiveAgent.length).toBeGreaterThan(0);
  });

  it('trend is valid value', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('sensitivityLevel values are valid', async () => {
    const report = await analyzeAgentPromptSensitivity();
    const valid = ['robust', 'moderate', 'sensitive', 'highly_sensitive'];
    for (const agent of report.agents) {
      expect(valid).toContain(agent.sensitivityLevel);
    }
  });

  it('aiRecommendations is non-empty array', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
    expect(report.aiRecommendations.length).toBeGreaterThan(0);
  });

  it('analysisTimestamp is ISO string', async () => {
    const report = await analyzeAgentPromptSensitivity();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
  });

  it('agent trend values are valid', async () => {
    const report = await analyzeAgentPromptSensitivity();
    const valid = ['improving', 'stable', 'degrading'];
    for (const agent of report.agents) {
      expect(valid).toContain(agent.trend);
    }
  });
});
