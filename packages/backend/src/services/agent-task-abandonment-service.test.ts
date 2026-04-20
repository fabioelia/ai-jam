import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeAbandonmentScore,
  getAbandonmentTier,
  analyzeAgentTaskAbandonment,
} from './agent-task-abandonment-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function setupDb(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

function makeSession(personaType: string, status: string, handoffTo: string | null = null) {
  return { id: `s-${Math.random().toString(36).slice(2)}`, personaType, status, handoffTo, startedAt: null, completedAt: null };
}

beforeEach(() => vi.clearAllMocks());

describe('computeAbandonmentScore', () => {
  it('base formula: rate=50, point=50 → 50', () => {
    expect(computeAbandonmentScore(50, 50)).toBe(50);
  });

  it('late bonus: avgAbandonmentPoint=80 → base + 5', () => {
    const base = computeAbandonmentScore(50, 50);
    const withBonus = computeAbandonmentScore(50, 80);
    expect(withBonus).toBe(base + 5);
  });

  it('early penalty: avgAbandonmentPoint=20 → base - 10', () => {
    const base = computeAbandonmentScore(50, 50);
    const withPenalty = computeAbandonmentScore(50, 20);
    expect(withPenalty).toBe(base - 10);
  });

  it('clamp: rate=0/point=50 → 100; rate=100/point=20 → 0', () => {
    expect(computeAbandonmentScore(0, 50)).toBe(100);
    expect(computeAbandonmentScore(100, 20)).toBe(0);
  });
});

describe('getAbandonmentTier', () => {
  it('reliable ≥ 80', () => {
    expect(getAbandonmentTier(80)).toBe('reliable');
    expect(getAbandonmentTier(100)).toBe('reliable');
  });

  it('moderate ≥ 60', () => {
    expect(getAbandonmentTier(60)).toBe('moderate');
    expect(getAbandonmentTier(79)).toBe('moderate');
  });

  it('inconsistent ≥ 40', () => {
    expect(getAbandonmentTier(40)).toBe('inconsistent');
    expect(getAbandonmentTier(59)).toBe('inconsistent');
  });

  it('volatile < 40', () => {
    expect(getAbandonmentTier(39)).toBe('volatile');
    expect(getAbandonmentTier(0)).toBe('volatile');
  });
});

describe('analyzeAgentTaskAbandonment', () => {
  it('returns AgentTaskAbandonmentReport shape with required fields', async () => {
    setupDb([makeSession('AgentA', 'completed'), makeSession('AgentA', 'failed')]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report).toHaveProperty('projectId', 'proj-1');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });

  it('summary fields populated: totalTasksStarted, totalTasksAbandoned, avgAbandonmentRate, mostReliableAgent, mostVolatileAgent, lowAbandonmentCount', async () => {
    setupDb([
      makeSession('AgentA', 'completed'),
      makeSession('AgentA', 'completed'),
      makeSession('AgentB', 'failed'),
      makeSession('AgentB', 'failed'),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(typeof report.summary.totalTasksStarted).toBe('number');
    expect(typeof report.summary.totalTasksAbandoned).toBe('number');
    expect(typeof report.summary.avgAbandonmentRate).toBe('number');
    expect(typeof report.summary.mostReliableAgent).toBe('string');
    expect(typeof report.summary.mostVolatileAgent).toBe('string');
    expect(typeof report.summary.lowAbandonmentCount).toBe('number');
  });

  it('agents array non-empty with all AgentTaskAbandonmentData fields', async () => {
    setupDb([makeSession('AgentA', 'completed'), makeSession('AgentA', 'failed')]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.agents.length).toBeGreaterThan(0);
    const agent = report.agents[0];
    expect(agent).toHaveProperty('agentId');
    expect(agent).toHaveProperty('agentName');
    expect(agent).toHaveProperty('tasksStarted');
    expect(agent).toHaveProperty('tasksAbandoned');
    expect(agent).toHaveProperty('tasksCompleted');
    expect(agent).toHaveProperty('abandonmentRate');
    expect(agent).toHaveProperty('avgAbandonmentPoint');
    expect(agent).toHaveProperty('topAbandonmentReason');
    expect(agent).toHaveProperty('abandonmentScore');
    expect(agent).toHaveProperty('abandonmentTier');
  });
});
