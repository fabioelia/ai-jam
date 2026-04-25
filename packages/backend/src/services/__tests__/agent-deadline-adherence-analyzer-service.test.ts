import { describe, it, expect, vi } from 'vitest';
import {
  computeAdherenceScore,
  getAdherenceTier,
  analyzeAgentDeadlineAdherenceAnalyzer,
} from '../agent-deadline-adherence-analyzer-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock deadline adherence summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

describe('computeAdherenceScore', () => {
  it('total=0 returns 50', () => {
    expect(computeAdherenceScore(0, 0, 0)).toBe(50);
  });

  it('all on time, delay<1h → base=70 + penalty=30 = 100', () => {
    expect(computeAdherenceScore(10, 10, 0.5)).toBe(100);
  });

  it('half on time, delay<1h → base=35 + penalty=30 = 65', () => {
    expect(computeAdherenceScore(5, 10, 0.5)).toBe(65);
  });

  it('all on time, delay 1-4h → base=70 + penalty=20 = 90', () => {
    expect(computeAdherenceScore(10, 10, 2)).toBe(90);
  });

  it('half on time, delay 4-12h → base=35 + penalty=10 = 45', () => {
    expect(computeAdherenceScore(5, 10, 8)).toBe(45);
  });

  it('none on time, delay>=12h → base=0 + penalty=0 = 0', () => {
    expect(computeAdherenceScore(0, 10, 15)).toBe(0);
  });

  it('clamps to 100 max', () => {
    expect(computeAdherenceScore(100, 100, 0)).toBeLessThanOrEqual(100);
  });

  it('clamps to 0 min', () => {
    expect(computeAdherenceScore(0, 100, 100)).toBeGreaterThanOrEqual(0);
  });
});

describe('getAdherenceTier', () => {
  it('returns excellent for score >= 85', () => {
    expect(getAdherenceTier(85)).toBe('excellent');
    expect(getAdherenceTier(100)).toBe('excellent');
  });

  it('returns good for score >= 70 and < 85', () => {
    expect(getAdherenceTier(70)).toBe('good');
    expect(getAdherenceTier(84)).toBe('good');
  });

  it('returns at-risk for score >= 50 and < 70', () => {
    expect(getAdherenceTier(50)).toBe('at-risk');
    expect(getAdherenceTier(69)).toBe('at-risk');
  });

  it('returns failing for score < 50', () => {
    expect(getAdherenceTier(49)).toBe('failing');
    expect(getAdherenceTier(0)).toBe('failing');
  });
});

describe('analyzeAgentDeadlineAdherenceAnalyzer', () => {
  it('returns correct report shape', async () => {
    const report = await analyzeAgentDeadlineAdherenceAnalyzer('project-1');
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
    const report = await analyzeAgentDeadlineAdherenceAnalyzer('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgAdherenceScore).toBe('number');
    expect(typeof report.summary.excellentCount).toBe('number');
    expect(typeof report.summary.criticalDelays).toBe('number');
  });

  it('each agent has required fields', async () => {
    const report = await analyzeAgentDeadlineAdherenceAnalyzer('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalDeadlines');
    expect(agent).toHaveProperty('metOnTime');
    expect(agent).toHaveProperty('avgDelayHours');
    expect(agent).toHaveProperty('adherenceScore');
    expect(agent).toHaveProperty('adherenceTier');
  });
});
