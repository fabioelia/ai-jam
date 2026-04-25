import { describe, it, expect } from 'vitest';
import {
  computeCollaborationScore,
  getCollaborationTier,
  analyzeAgentCollaborationNetwork,
} from '../agent-collaboration-network-analyzer-service.js';

describe('computeCollaborationScore', () => {
  it('returns 0 for isolated agent with no handoffs', () => {
    expect(computeCollaborationScore(0, 0, 0, 5)).toBe(0);
  });

  it('sent component capped at 30', () => {
    const score = computeCollaborationScore(10, 0, 0, 2);
    expect(score).toBe(30);
  });

  it('received component capped at 30', () => {
    const score = computeCollaborationScore(0, 10, 0, 2);
    expect(score).toBe(30);
  });

  it('diversity component scales with uniqueCollaborators/totalAgents', () => {
    const full = computeCollaborationScore(0, 0, 4, 5);
    const half = computeCollaborationScore(0, 0, 2, 5);
    expect(full).toBeGreaterThan(half);
  });

  it('diversity component is 0 for single agent', () => {
    const score = computeCollaborationScore(0, 0, 1, 1);
    expect(score).toBe(0);
  });

  it('clamps to 0-100', () => {
    expect(computeCollaborationScore(100, 100, 100, 2)).toBeLessThanOrEqual(100);
    expect(computeCollaborationScore(0, 0, 0, 5)).toBeGreaterThanOrEqual(0);
  });

  it('combined score sums components', () => {
    const score = computeCollaborationScore(3, 3, 4, 5);
    expect(score).toBe(15 + 15 + 40);
  });
});

describe('getCollaborationTier', () => {
  it('returns hub for score >= 75', () => {
    expect(getCollaborationTier(75)).toBe('hub');
    expect(getCollaborationTier(100)).toBe('hub');
  });

  it('returns collaborative for score 50-74', () => {
    expect(getCollaborationTier(50)).toBe('collaborative');
    expect(getCollaborationTier(74)).toBe('collaborative');
  });

  it('returns contributing for score 25-49', () => {
    expect(getCollaborationTier(25)).toBe('contributing');
    expect(getCollaborationTier(49)).toBe('contributing');
  });

  it('returns isolated for score < 25', () => {
    expect(getCollaborationTier(24)).toBe('isolated');
    expect(getCollaborationTier(0)).toBe('isolated');
  });
});

describe('analyzeAgentCollaborationNetwork', () => {
  it('returns report with expected shape', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    expect(report.projectId).toBe('project-1');
    expect(report.generatedAt).toBeTruthy();
    expect(report.summary.totalAgents).toBeGreaterThan(0);
    expect(report.agents.length).toBe(report.summary.totalAgents);
    expect(report.aiSummary).toBeTruthy();
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('agents have required fields', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    for (const agent of report.agents) {
      expect(agent.agentId).toBeTruthy();
      expect(agent.agentName).toBeTruthy();
      expect(agent.collaborationScore).toBeGreaterThanOrEqual(0);
      expect(agent.collaborationScore).toBeLessThanOrEqual(100);
      expect(['hub', 'collaborative', 'contributing', 'isolated']).toContain(agent.collaborationTier);
      expect(typeof agent.isHub).toBe('boolean');
      expect(typeof agent.isIsolated).toBe('boolean');
    }
  });

  it('isHub agents have handoffsReceived >= 5', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    for (const agent of report.agents) {
      if (agent.isHub) expect(agent.handoffsReceived).toBeGreaterThanOrEqual(5);
    }
  });

  it('isIsolated agents have totalHandoffs === 0', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    for (const agent of report.agents) {
      if (agent.isIsolated) expect(agent.totalHandoffs).toBe(0);
    }
  });

  it('totalHandoffs matches agents handoffsSent sum', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    const sentSum = report.agents.reduce((s, a) => s + a.handoffsSent, 0);
    expect(report.summary.totalHandoffs).toBe(sentSum);
  });

  it('summary hub count matches agent isHub count', async () => {
    const report = await analyzeAgentCollaborationNetwork('project-1');
    const hubCount = report.agents.filter((a) => a.isHub).length;
    expect(report.summary.hubCount).toBe(hubCount);
  });
});
