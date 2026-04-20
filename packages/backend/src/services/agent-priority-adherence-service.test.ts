import { describe, it, expect } from 'vitest';
import {
  analyzeAgentPriorityAdherence,
  computeAdherenceScore,
  computeAdherenceTier,
} from './agent-priority-adherence-service.js';

function makeSession(
  agentId: string,
  totalTasks: number,
  correctPrioritySequences: number,
  totalSequenceOpportunities: number,
  priorityInversions: number = 0,
  high = 0,
  medium = 0,
  low = 0,
) {
  return {
    agentId,
    totalTasks,
    highPriorityTasks: high,
    mediumPriorityTasks: medium,
    lowPriorityTasks: low,
    priorityInversions,
    correctPrioritySequences,
    totalSequenceOpportunities,
  };
}

describe('computeAdherenceScore', () => {
  it('applies bonus +10 when adherenceRate >= 95', () => {
    const score = computeAdherenceScore(95, 0, 100);
    expect(score).toBe(100); // 95 + 10 = 105, clamped to 100
  });

  it('applies bonus +5 when adherenceRate >= 80', () => {
    const score = computeAdherenceScore(80, 0, 100);
    expect(score).toBe(85); // 80 + 5 = 85
  });

  it('applies penalty -15 when inversions > 20% of totalTasks', () => {
    // adherenceRate=60, inversions=30 > 20% of 100 → 60 - 15 = 45
    const score = computeAdherenceScore(60, 30, 100);
    expect(score).toBe(45);
  });

  it('no penalty when inversions <= 20% of totalTasks', () => {
    const score = computeAdherenceScore(60, 20, 100);
    expect(score).toBe(60); // exactly 20%, not > 20%
  });
});

describe('computeAdherenceTier', () => {
  it('disciplined when adherenceScore >= 85', () => expect(computeAdherenceTier(85)).toBe('disciplined'));
  it('consistent when adherenceScore 65-84', () => expect(computeAdherenceTier(65)).toBe('consistent'));
  it('drifting when adherenceScore 40-64', () => expect(computeAdherenceTier(40)).toBe('drifting'));
  it('chaotic when adherenceScore < 40', () => expect(computeAdherenceTier(39)).toBe('chaotic'));
});

describe('analyzeAgentPriorityAdherence', () => {
  it('returns correct report structure with all required fields', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 9, 10, 0, 5, 3, 2),
    ]);
    expect(report).toHaveProperty('projectId', 'proj-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report.summary).toHaveProperty('totalAgents', 1);
    expect(report.summary).toHaveProperty('totalTasks', 10);
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('insights');
    expect(report).toHaveProperty('recommendations');
  });

  it('calculates adherenceRate correctly (correctPrioritySequences / totalSequenceOpportunities * 100)', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 8, 10),
    ]);
    expect(report.agents[0].adherenceRate).toBe(80);
  });

  it('assigns disciplined tier when adherenceScore >= 85', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 10, 10, 0), // 100% → score 100+10=clamped → 100 → disciplined
    ]);
    expect(report.agents[0].adherenceTier).toBe('disciplined');
  });

  it('assigns consistent tier when adherenceScore 65-84', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 7, 10, 0), // 70% + 0 bonus → 70 → consistent
    ]);
    expect(report.agents[0].adherenceTier).toBe('consistent');
  });

  it('assigns drifting tier when adherenceScore 40-64', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 5, 10, 0), // 50% → 50 → drifting
    ]);
    expect(report.agents[0].adherenceTier).toBe('drifting');
  });

  it('assigns chaotic tier when adherenceScore < 40', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 2, 10, 4), // 20% - 15 penalty = 5 → chaotic
    ]);
    expect(report.agents[0].adherenceTier).toBe('chaotic');
  });

  it('applies bonus +10 when adherenceRate >= 95', () => {
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 10, 10, 0), // 100% → +10 → clamped to 100
    ]);
    expect(report.agents[0].adherenceScore).toBe(100);
  });

  it('applies penalty -15 when priorityInversions > 20% of totalTasks', () => {
    // 60% adherence, 3 inversions out of 10 tasks (30% > 20%) → 60 - 15 = 45
    const report = analyzeAgentPriorityAdherence('proj-1', [
      makeSession('alice', 10, 6, 10, 3),
    ]);
    expect(report.agents[0].adherenceScore).toBe(45);
  });
});
