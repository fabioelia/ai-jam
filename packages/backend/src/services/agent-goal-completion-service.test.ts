import { describe, it, expect } from 'vitest';
import {
  analyzeAgentGoalCompletion,
  computeCompletionScore,
  computeCompletionTier,
} from './agent-goal-completion-service.js';

function makeSession(agentId: string, agentName: string, status: string) {
  return { agentId, agentName, status };
}

describe('analyzeAgentGoalCompletion', () => {
  it('returns correct report structure', () => {
    const sessions = [
      makeSession('agent-1', 'Alice', 'completed'),
      makeSession('agent-1', 'Alice', 'failed'),
    ];
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report).toHaveProperty('projectId', 'proj-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report.summary).toHaveProperty('totalAgents');
    expect(report.summary).toHaveProperty('totalGoals');
    expect(report.summary).toHaveProperty('overallCompletionRate');
    expect(report.summary).toHaveProperty('topPerformer');
    expect(report.summary).toHaveProperty('mostStruggling');
    expect(report.summary).toHaveProperty('exceptionalAgents');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('insights');
    expect(report).toHaveProperty('recommendations');
  });

  it('calculates completionRate correctly', () => {
    const sessions = [
      makeSession('agent-1', 'Alice', 'completed'),
      makeSession('agent-1', 'Alice', 'completed'),
      makeSession('agent-1', 'Alice', 'failed'),
      makeSession('agent-1', 'Alice', 'failed'),
    ];
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report.agents[0].completionRate).toBe(50); // 2 completed / 4 total = 50%
  });

  it('assigns exceptional tier when score >= 85', () => {
    // 10 completed out of 10 → completionRate=100, score=100+10=clamp=100 → exceptional
    const sessions = Array.from({ length: 10 }, () => makeSession('agent-1', 'Alice', 'completed'));
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report.agents[0].completionTier).toBe('exceptional');
  });

  it('assigns solid tier when score is 65-84', () => {
    // 7 completed, 3 failed → completionRate=70, no bonus (< 75), no penalty (3/10=30% not >30%) → score=70 → solid
    const sessions = [
      ...Array.from({ length: 7 }, () => makeSession('agent-1', 'Alice', 'completed')),
      ...Array.from({ length: 3 }, () => makeSession('agent-1', 'Alice', 'failed')),
    ];
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report.agents[0].completionTier).toBe('solid');
  });

  it('assigns partial tier when score is 40-64', () => {
    // 5 completed, 5 failed → completionRate=50, no bonus (<75), penalty: 5/10=50%>30% → score=50-10=40 → partial
    const sessions = [
      ...Array.from({ length: 5 }, () => makeSession('agent-1', 'Alice', 'completed')),
      ...Array.from({ length: 5 }, () => makeSession('agent-1', 'Alice', 'failed')),
    ];
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report.agents[0].completionTier).toBe('partial');
  });

  it('assigns struggling tier when score < 40', () => {
    // 2 completed, 8 failed → completionRate=20, no bonus, penalty: 8/10=80%>30% → score=20-10=10 → struggling
    const sessions = [
      ...Array.from({ length: 2 }, () => makeSession('agent-1', 'Alice', 'completed')),
      ...Array.from({ length: 8 }, () => makeSession('agent-1', 'Alice', 'failed')),
    ];
    const report = analyzeAgentGoalCompletion('proj-1', sessions);
    expect(report.agents[0].completionTier).toBe('struggling');
  });

  it('applies bonus for completionRate >= 90', () => {
    // completionRate=100 → bonus +10
    const score = computeCompletionScore(100, 0, 10);
    expect(score).toBe(100); // clamped at 100 (100 + 10 = 110 → clamped)

    // completionRate=90 → bonus +10
    const score90 = computeCompletionScore(90, 0, 10);
    expect(score90).toBe(100); // 90 + 10 = 100
  });

  it('applies penalty when failed > 30% of totalGoals', () => {
    // completionRate=60, failed=4, totalGoals=10 → 4/10=40%>30% → penalty -10 → 50
    const score = computeCompletionScore(60, 4, 10);
    expect(score).toBe(50);
  });
});

describe('computeCompletionTier', () => {
  it('returns exceptional for score >= 85', () => {
    expect(computeCompletionTier(85)).toBe('exceptional');
    expect(computeCompletionTier(100)).toBe('exceptional');
  });

  it('returns solid for score 65-84', () => {
    expect(computeCompletionTier(65)).toBe('solid');
    expect(computeCompletionTier(84)).toBe('solid');
  });

  it('returns partial for score 40-64', () => {
    expect(computeCompletionTier(40)).toBe('partial');
    expect(computeCompletionTier(64)).toBe('partial');
  });

  it('returns struggling for score < 40', () => {
    expect(computeCompletionTier(39)).toBe('struggling');
    expect(computeCompletionTier(0)).toBe('struggling');
  });
});
