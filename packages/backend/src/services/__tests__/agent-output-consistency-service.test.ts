import { describe, it, expect } from 'vitest';
import { computeConsistencyScore, computeConsistencyTier, analyzeAgentOutputConsistency } from '../agent-output-consistency-service.js';

describe('computeConsistencyScore', () => {
  it('uses formatConsistencyRate as base', () => {
    expect(computeConsistencyScore(70, 200)).toBe(70);
  });

  it('adds +10 bonus when variance < 100 AND formatConsistencyRate >= 80', () => {
    expect(computeConsistencyScore(80, 50)).toBe(90);
  });

  it('does NOT add bonus when variance >= 100', () => {
    expect(computeConsistencyScore(80, 100)).toBe(80);
  });

  it('applies -15 penalty when variance > 500', () => {
    expect(computeConsistencyScore(70, 600)).toBe(55);
  });

  it('clamps to 0-100', () => {
    expect(computeConsistencyScore(100, 50)).toBe(100);
    expect(computeConsistencyScore(10, 600)).toBe(0);
  });
});

describe('computeConsistencyTier', () => {
  it('returns stable at score >= 85', () => {
    expect(computeConsistencyTier(85)).toBe('stable');
    expect(computeConsistencyTier(100)).toBe('stable');
  });

  it('returns mostly-stable at score 65-84', () => {
    expect(computeConsistencyTier(65)).toBe('mostly-stable');
    expect(computeConsistencyTier(84)).toBe('mostly-stable');
  });

  it('returns variable at score 40-64', () => {
    expect(computeConsistencyTier(40)).toBe('variable');
    expect(computeConsistencyTier(64)).toBe('variable');
  });

  it('returns erratic at score < 40', () => {
    expect(computeConsistencyTier(0)).toBe('erratic');
    expect(computeConsistencyTier(39)).toBe('erratic');
  });
});

describe('analyzeAgentOutputConsistency', () => {
  it('returns report with correct shape (generatedAt, summary, agents, insights, recommendations)', async () => {
    const sessions = [
      { personaType: 'dev', status: 'completed', outputSummary: 'Done' },
    ];
    const report = await analyzeAgentOutputConsistency('proj1', sessions);
    expect(report.projectId).toBe('proj1');
    expect(report.generatedAt).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.insights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('uses sessions param (empty sessions = empty agents)', async () => {
    const report = await analyzeAgentOutputConsistency('proj1', []);
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });
});
