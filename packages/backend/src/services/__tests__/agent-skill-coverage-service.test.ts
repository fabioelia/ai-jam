import { describe, it, expect, vi } from 'vitest';
import {
  computeCoverageScore,
  getCoverageTier,
  analyzeAgentSkillCoverage,
} from '../agent-skill-coverage-service.js';

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock skill coverage summary\nRec 1\nRec 2\nRec 3' }],
      }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

const fullPriority = { urgent: 1, high: 1, medium: 1, low: 1 };
const fullComplexity = { simple: 1, standard: 1, complex: 1 };
const singlePriority = { urgent: 1, high: 0, medium: 0, low: 0 };
const singleComplexity = { simple: 1, standard: 0, complex: 0 };

describe('computeCoverageScore', () => {
  it('returns max diversityBase for full coverage with >= 20 tickets', () => {
    // priorityTiers=4, complexityTiers=3, diversityBase=50+50=100, volumeBonus=10 → clamped 100
    expect(computeCoverageScore(fullPriority, fullComplexity, 20)).toBe(100);
  });

  it('returns correct score for full coverage with < 10 tickets (no bonus)', () => {
    // diversityBase=100, volumeBonus=0 → 100
    expect(computeCoverageScore(fullPriority, fullComplexity, 5)).toBe(100);
  });

  it('returns correct diversityBase for single priority + single complexity', () => {
    // priorityTiers=1/4=0.25 → 12.5, complexityTiers=1/3≈0.333 → 16.67, sum≈29.17 → rounded 29
    // No volume bonus (totalTickets=1)
    const score = computeCoverageScore(singlePriority, singleComplexity, 1);
    expect(score).toBe(29);
  });

  it('applies volumeBonus of 10 for totalTickets >= 20', () => {
    // single priority + single complexity → diversityBase≈29, volumeBonus=10 → 39
    expect(computeCoverageScore(singlePriority, singleComplexity, 20)).toBe(39);
  });

  it('applies volumeBonus of 5 for totalTickets >= 10', () => {
    // single priority + single complexity → diversityBase≈29, volumeBonus=5 → 34
    expect(computeCoverageScore(singlePriority, singleComplexity, 10)).toBe(34);
  });

  it('applies no volumeBonus for totalTickets < 10', () => {
    const scoreWith9 = computeCoverageScore(singlePriority, singleComplexity, 9);
    const scoreWith1 = computeCoverageScore(singlePriority, singleComplexity, 1);
    expect(scoreWith9).toBe(scoreWith1);
  });

  it('clamps score at 0 minimum', () => {
    const score = computeCoverageScore({ urgent: 0, high: 0, medium: 0, low: 0 }, { simple: 0, standard: 0, complex: 0 }, 0);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('clamps score at 100 maximum', () => {
    expect(computeCoverageScore(fullPriority, fullComplexity, 100)).toBeLessThanOrEqual(100);
  });
});

describe('getCoverageTier', () => {
  it('returns versatile for score >= 80', () => {
    expect(getCoverageTier(80)).toBe('versatile');
    expect(getCoverageTier(100)).toBe('versatile');
  });

  it('returns broad for score >= 60 and < 80', () => {
    expect(getCoverageTier(60)).toBe('broad');
    expect(getCoverageTier(79)).toBe('broad');
  });

  it('returns focused for score >= 40 and < 60', () => {
    expect(getCoverageTier(40)).toBe('focused');
    expect(getCoverageTier(59)).toBe('focused');
  });

  it('returns specialist for score < 40', () => {
    expect(getCoverageTier(39)).toBe('specialist');
    expect(getCoverageTier(0)).toBe('specialist');
  });
});

describe('analyzeAgentSkillCoverage', () => {
  it('returns correct report shape', async () => {
    const report = await analyzeAgentSkillCoverage('project-1');
    expect(report).toHaveProperty('projectId', 'project-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('summary fields are present and correctly typed', async () => {
    const report = await analyzeAgentSkillCoverage('project-1');
    expect(typeof report.summary.totalAgents).toBe('number');
    expect(typeof report.summary.avgCoverageScore).toBe('number');
    expect(typeof report.summary.fullCoverageCount).toBe('number');
    expect(typeof report.summary.specializationCount).toBe('number');
    expect(typeof report.summary.ticketCategoriesTotal).toBe('number');
  });

  it('agents array is non-empty with required fields', async () => {
    const report = await analyzeAgentSkillCoverage('project-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('agentRole');
    expect(agent).toHaveProperty('totalTickets');
    expect(agent).toHaveProperty('priorityCoverage');
    expect(agent).toHaveProperty('complexityCoverage');
    expect(agent).toHaveProperty('coverageScore');
    expect(agent).toHaveProperty('coverageTier');
    expect(agent).toHaveProperty('dominantPriority');
    expect(agent).toHaveProperty('dominantComplexity');
  });

  it('ticketCategoriesTotal is within bounds (0 to 12)', async () => {
    const report = await analyzeAgentSkillCoverage('project-1');
    expect(report.summary.ticketCategoriesTotal).toBeGreaterThan(0);
    expect(report.summary.ticketCategoriesTotal).toBeLessThanOrEqual(12);
  });
});
