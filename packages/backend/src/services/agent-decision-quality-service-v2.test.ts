import { describe, it, expect } from 'vitest';
import {
  analyzeAgentDecisionQuality,
  computeQualityScore,
  computeQualityTier,
} from './agent-decision-quality-service-v2.js';

function makeSession(
  id: string,
  personaType: string,
  status: string,
  retryCount = 0,
): any {
  return { id, personaType, status, retryCount };
}

describe('analyzeAgentDecisionQuality', () => {
  it('returns correct report structure', () => {
    const sessions = [makeSession('s1', 'AgentA', 'completed', 0)];
    const report = analyzeAgentDecisionQuality('proj-1', sessions);
    expect(report).toHaveProperty('projectId', 'proj-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('insights');
    expect(report).toHaveProperty('recommendations');
    expect(report.summary).toHaveProperty('totalAgents');
    expect(report.summary).toHaveProperty('totalDecisions');
    expect(report.summary).toHaveProperty('topDecisionMaker');
    expect(report.summary).toHaveProperty('avgCorrectnessRate');
    expect(report.summary).toHaveProperty('highQualityAgents');
  });

  it('computes qualityScore using the formula correctly', () => {
    // correctnessRate=100, revisionRate=0, impactScore=100
    // score = 100*0.5 + (100-0)*0.3 + 100*0.2 = 50+30+20 = 100
    const score = computeQualityScore(100, 0, 100);
    expect(score).toBe(100);
  });

  it('clamps qualityScore to 0-100', () => {
    expect(computeQualityScore(0, 100, 0)).toBeGreaterThanOrEqual(0);
    expect(computeQualityScore(100, 0, 100)).toBeLessThanOrEqual(100);
  });

  it('assigns excellent tier for qualityScore >= 80', () => {
    // 1 agent, 10 sessions: 10 completed with 0 retries → correctness=100, revision=0, impact=100
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession(`s${i}`, 'AgentA', 'completed', 0),
    );
    const report = analyzeAgentDecisionQuality('proj-1', sessions);
    const agent = report.agents[0];
    expect(agent.qualityTier).toBe('excellent');
    expect(agent.qualityScore).toBeGreaterThanOrEqual(80);
  });

  it('assigns good tier for qualityScore >= 60 and < 80', () => {
    expect(computeQualityTier(75)).toBe('good');
    expect(computeQualityTier(60)).toBe('good');
    expect(computeQualityTier(79)).toBe('good');
  });

  it('assigns improving tier for qualityScore >= 40 and < 60', () => {
    expect(computeQualityTier(50)).toBe('improving');
    expect(computeQualityTier(40)).toBe('improving');
    expect(computeQualityTier(59)).toBe('improving');
  });

  it('assigns struggling tier for qualityScore < 40', () => {
    expect(computeQualityTier(39)).toBe('struggling');
    expect(computeQualityTier(0)).toBe('struggling');
  });

  it('sets topDecisionMaker to agent with highest qualityScore', () => {
    const sessions = [
      makeSession('s1', 'AgentA', 'completed', 0),
      makeSession('s2', 'AgentA', 'completed', 0),
      makeSession('s3', 'AgentB', 'failed', 2),
      makeSession('s4', 'AgentB', 'failed', 3),
    ];
    const report = analyzeAgentDecisionQuality('proj-1', sessions);
    expect(report.summary.topDecisionMaker).toBe('AgentA');
  });

  it('impactScore contribution: more completed = higher score', () => {
    const sessionsA = [
      makeSession('a1', 'AgentA', 'completed', 0),
      makeSession('a2', 'AgentA', 'completed', 0),
      makeSession('a3', 'AgentA', 'failed', 0),
    ];
    const sessionsB = [
      makeSession('b1', 'AgentB', 'failed', 0),
      makeSession('b2', 'AgentB', 'failed', 0),
      makeSession('b3', 'AgentB', 'failed', 0),
    ];
    const report = analyzeAgentDecisionQuality('proj-1', [...sessionsA, ...sessionsB]);
    const agentA = report.agents.find((a) => a.agentId === 'AgentA')!;
    const agentB = report.agents.find((a) => a.agentId === 'AgentB')!;
    expect(agentA.qualityScore).toBeGreaterThan(agentB.qualityScore);
  });

  it('returns empty agents and appropriate insights for empty project', () => {
    const report = analyzeAgentDecisionQuality('proj-empty', []);
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.topDecisionMaker).toBeNull();
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
