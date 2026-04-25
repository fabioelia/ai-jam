import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentMultiTurnConsistency,
  computeConsistencyScore,
  getConsistencyLevel,
} from '../agent-multi-turn-consistency-analyzer-service.js';

vi.mock('anthropic', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Consistency analysis complete.' }],
      }),
    };
  },
}));

describe('computeConsistencyScore', () => {
  it('returns 100 when zero sessions', () => {
    expect(computeConsistencyScore(0, 0)).toBe(100);
  });

  it('returns 100 when no issues', () => {
    expect(computeConsistencyScore(10, 0)).toBe(100);
  });

  it('returns 0 when all sessions have issues', () => {
    expect(computeConsistencyScore(10, 10)).toBe(0);
  });

  it('returns 80 for 2 issues in 10 sessions', () => {
    expect(computeConsistencyScore(10, 2)).toBe(80);
  });

  it('clamps at 0 for over 100% issues', () => {
    expect(computeConsistencyScore(5, 10)).toBe(0);
  });
});

describe('getConsistencyLevel', () => {
  it('returns excellent for score >= 85', () => {
    expect(getConsistencyLevel(90)).toBe('excellent');
    expect(getConsistencyLevel(85)).toBe('excellent');
  });

  it('returns good for score 70-84', () => {
    expect(getConsistencyLevel(75)).toBe('good');
    expect(getConsistencyLevel(70)).toBe('good');
  });

  it('returns fair for score 50-69', () => {
    expect(getConsistencyLevel(60)).toBe('fair');
    expect(getConsistencyLevel(50)).toBe('fair');
  });

  it('returns poor for score < 50', () => {
    expect(getConsistencyLevel(30)).toBe('poor');
    expect(getConsistencyLevel(0)).toBe('poor');
  });
});

describe('analyzeAgentMultiTurnConsistency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid report shape', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(report).toHaveProperty('consistencyScore');
    expect(report).toHaveProperty('totalSessions');
    expect(report).toHaveProperty('contradictionRate');
    expect(report).toHaveProperty('contextLossRate');
    expect(report).toHaveProperty('goalDriftRate');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('mostConsistentAgent');
    expect(report).toHaveProperty('leastConsistentAgent');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('consistencyScore is in 0-100', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(report.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(report.consistencyScore).toBeLessThanOrEqual(100);
  });

  it('agents array is non-empty', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(report.agents.length).toBeGreaterThan(0);
  });

  it('each agent has required fields', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    for (const agent of report.agents) {
      expect(agent).toHaveProperty('agentId');
      expect(agent).toHaveProperty('agentName');
      expect(agent).toHaveProperty('totalSessions');
      expect(agent).toHaveProperty('sessionsWithContradictions');
      expect(agent).toHaveProperty('sessionsWithContextLoss');
      expect(agent).toHaveProperty('sessionsWithGoalDrift');
      expect(agent).toHaveProperty('consistencyScore');
      expect(agent).toHaveProperty('trend');
      expect(agent).toHaveProperty('consistencyLevel');
    }
  });

  it('agent consistencyScore is in 0-100', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    for (const agent of report.agents) {
      expect(agent.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(agent.consistencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('contradictionRate is a percentage', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(report.contradictionRate).toBeGreaterThanOrEqual(0);
    expect(report.contradictionRate).toBeLessThanOrEqual(100);
  });

  it('contextLossRate is a percentage', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(report.contextLossRate).toBeGreaterThanOrEqual(0);
    expect(report.contextLossRate).toBeLessThanOrEqual(100);
  });

  it('goalDriftRate is a percentage', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(report.goalDriftRate).toBeGreaterThanOrEqual(0);
    expect(report.goalDriftRate).toBeLessThanOrEqual(100);
  });

  it('totalSessions equals sum of agent sessions', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    const sum = report.agents.reduce((s, a) => s + a.totalSessions, 0);
    expect(report.totalSessions).toBe(sum);
  });

  it('mostConsistentAgent is a string', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(typeof report.mostConsistentAgent).toBe('string');
    expect(report.mostConsistentAgent.length).toBeGreaterThan(0);
  });

  it('leastConsistentAgent is a string', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(typeof report.leastConsistentAgent).toBe('string');
    expect(report.leastConsistentAgent.length).toBeGreaterThan(0);
  });

  it('trend is valid value', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
  });

  it('aiRecommendations is non-empty array', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
    expect(report.aiRecommendations.length).toBeGreaterThan(0);
  });

  it('analysisTimestamp is ISO string', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
  });

  it('consistencyLevel values are valid', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    const valid = ['excellent', 'good', 'fair', 'poor'];
    for (const agent of report.agents) {
      expect(valid).toContain(agent.consistencyLevel);
    }
  });

  it('agent trend values are valid', async () => {
    const report = await analyzeAgentMultiTurnConsistency();
    const valid = ['improving', 'stable', 'degrading'];
    for (const agent of report.agents) {
      expect(valid).toContain(agent.trend);
    }
  });
});
