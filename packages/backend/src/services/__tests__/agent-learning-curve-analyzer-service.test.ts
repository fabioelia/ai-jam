import { describe, it, expect } from 'vitest';
import {
  computeLearningScore,
  getLearningTier,
  getTrend,
  analyzeAgentLearningCurve,
} from '../agent-learning-curve-analyzer-service.js';

describe('computeLearningScore', () => {
  it('returns 50 baseline with no delta and no sessions', () => {
    expect(computeLearningScore(0, 0, 0)).toBe(50);
  });

  it('positive completion delta increases score', () => {
    const score = computeLearningScore(0.3, 0, 0);
    expect(score).toBeGreaterThan(50);
  });

  it('negative completion delta decreases score', () => {
    const score = computeLearningScore(-0.3, 0, 0);
    expect(score).toBeLessThan(50);
  });

  it('positive durationDelta (getting faster) increases score', () => {
    const score = computeLearningScore(0, 120000, 0);
    expect(score).toBeGreaterThan(50);
  });

  it('negative durationDelta (getting slower) decreases score', () => {
    const score = computeLearningScore(0, -120000, 0);
    expect(score).toBeLessThan(50);
  });

  it('volume bonus for 10+ sessions', () => {
    const withBonus = computeLearningScore(0, 0, 10);
    const withoutBonus = computeLearningScore(0, 0, 0);
    expect(withBonus).toBeGreaterThan(withoutBonus);
  });

  it('volume bonus for 20+ sessions larger', () => {
    const bonus10 = computeLearningScore(0, 0, 10);
    const bonus20 = computeLearningScore(0, 0, 20);
    expect(bonus20).toBeGreaterThan(bonus10);
  });

  it('clamps to 0-100 range', () => {
    expect(computeLearningScore(1, 9999999, 100)).toBeLessThanOrEqual(100);
    expect(computeLearningScore(-1, -9999999, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('getLearningTier', () => {
  it('returns accelerating for score >= 80', () => {
    expect(getLearningTier(80)).toBe('accelerating');
    expect(getLearningTier(95)).toBe('accelerating');
  });

  it('returns improving for score 60-79', () => {
    expect(getLearningTier(60)).toBe('improving');
    expect(getLearningTier(79)).toBe('improving');
  });

  it('returns stable for score 40-59', () => {
    expect(getLearningTier(40)).toBe('stable');
    expect(getLearningTier(59)).toBe('stable');
  });

  it('returns declining for score < 40', () => {
    expect(getLearningTier(39)).toBe('declining');
    expect(getLearningTier(0)).toBe('declining');
  });
});

describe('getTrend', () => {
  it('returns improving when completionRateDelta > 0.05', () => {
    expect(getTrend(0.1, 0)).toBe('improving');
  });

  it('returns improving when durationDeltaMs > 30000', () => {
    expect(getTrend(0, 60000)).toBe('improving');
  });

  it('returns declining when completionRateDelta < -0.05', () => {
    expect(getTrend(-0.1, 0)).toBe('declining');
  });

  it('returns declining when durationDeltaMs < -30000', () => {
    expect(getTrend(0, -60000)).toBe('declining');
  });

  it('returns stable for small deltas', () => {
    expect(getTrend(0.01, 10000)).toBe('stable');
  });
});

describe('analyzeAgentLearningCurve', () => {
  it('returns report with expected shape', async () => {
    const report = await analyzeAgentLearningCurve('project-1');
    expect(report.projectId).toBe('project-1');
    expect(report.generatedAt).toBeTruthy();
    expect(report.summary.totalAgents).toBeGreaterThan(0);
    expect(report.agents.length).toBe(report.summary.totalAgents);
    expect(report.aiSummary).toBeTruthy();
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('agents have required fields', async () => {
    const report = await analyzeAgentLearningCurve('project-1');
    for (const agent of report.agents) {
      expect(agent.agentId).toBeTruthy();
      expect(agent.agentName).toBeTruthy();
      expect(agent.learningScore).toBeGreaterThanOrEqual(0);
      expect(agent.learningScore).toBeLessThanOrEqual(100);
      expect(['accelerating', 'improving', 'stable', 'declining']).toContain(agent.learningTier);
      expect(['improving', 'declining', 'stable', 'insufficient_data']).toContain(agent.trend);
    }
  });

  it('summary counts match agent array', async () => {
    const report = await analyzeAgentLearningCurve('project-1');
    const improving = report.agents.filter((a) => a.trend === 'improving').length;
    const declining = report.agents.filter((a) => a.trend === 'declining').length;
    expect(report.summary.improvingCount).toBe(improving);
    expect(report.summary.decliningCount).toBe(declining);
  });
});
