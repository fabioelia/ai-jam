import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionFollowingFidelityAnalyzer } from '../agent-instruction-following-fidelity-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date) {
  return {
    id: Math.random().toString(),
    agentId,
    status: 'completed',
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + 30000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentInstructionFollowingFidelityAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgFidelityScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(typeof report.fleetAvgFidelityScore).toBe('number');
  });

  it('returns lowFidelityAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(typeof report.lowFidelityAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('handles empty sessions gracefully', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgFidelityScore).toBe(0);
    expect(report.lowFidelityAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fidelityScore is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].fidelityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].fidelityScore).toBeLessThanOrEqual(100);
    }
  });

  it('exactComplianceRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].exactComplianceRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].exactComplianceRate).toBeLessThanOrEqual(100);
    }
  });

  it('omissionRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].omissionRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].omissionRate).toBeLessThanOrEqual(100);
    }
  });

  it('additionRate is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].additionRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].additionRate).toBeLessThanOrEqual(100);
    }
  });

  it('interpretationAccuracy is 0-100', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].interpretationAccuracy).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].interpretationAccuracy).toBeLessThanOrEqual(100);
    }
  });

  it('fidelityTrend is one of improving/stable/worsening', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'worsening']).toContain(report.metrics[0].fidelityTrend);
    }
  });

  it('rating is one of excellent/good/fair/poor', async () => {
    const now = new Date();
    setupMock([makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000))]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(report.metrics[0].rating);
    }
  });

  it('metrics sorted ascending by fidelityScore', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].fidelityScore).toBeLessThanOrEqual(report.metrics[i].fidelityScore);
    }
  });

  it('lowFidelityAgents counts agents with fidelityScore < 60', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    const expected = report.metrics.filter(m => m.fidelityScore < 60).length;
    expect(report.lowFidelityAgents).toBe(expected);
  });

  it('fleetAvgFidelityScore is average of metric fidelityScores', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now), makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 120000)), makeSession('AgentB', new Date(now.getTime() + 180000)),
    ]);
    const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
    if (report.metrics.length > 0) {
      const expected = Math.round(report.metrics.reduce((s, m) => s + m.fidelityScore, 0) / report.metrics.length);
      expect(report.fleetAvgFidelityScore).toBe(expected);
    }
  });
});
