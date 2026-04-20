import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeAbandonmentScore, getAbandonmentTier, analyzeAgentTaskAbandonment } from './agent-task-abandonment-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic { messages = { create: mockCreate }; }
  return { default: MockAnthropic };
});
import { db } from '../db/connection.js';

function makeSession(persona: string, status: string) {
  return {
    id: Math.random().toString(),
    personaId: persona,
    personaType: persona,
    status,
    projectId: 'proj-1',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    completedAt: status === 'completed' ? new Date('2024-01-01T11:00:00Z') : new Date('2024-01-01T10:30:00Z'),
    ticketId: 't1',
  };
}

function setupDb(ticketRows: unknown[], sessionRows: unknown[]) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    const currentCall = callCount;
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve(ticketRows);
        return Promise.resolve(sessionRows);
      }),
    };
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('computeAbandonmentScore', () => {
  it('returns 50 for rate=50, avgAbandonmentPoint=50 (no bonus/penalty)', () => {
    expect(computeAbandonmentScore(50, 50)).toBe(50);
  });

  it('adds 5 bonus when avgAbandonmentPoint > 75', () => {
    const score = computeAbandonmentScore(50, 80);
    expect(score).toBe(55);
  });

  it('subtracts 10 penalty when avgAbandonmentPoint < 25', () => {
    const score = computeAbandonmentScore(50, 20);
    expect(score).toBe(40);
  });

  it('clamps score between 0 and 100', () => {
    expect(computeAbandonmentScore(0, 50)).toBe(100);
    expect(computeAbandonmentScore(100, 20)).toBe(0);
  });
});

describe('getAbandonmentTier', () => {
  it('returns reliable for score >= 80', () => {
    expect(getAbandonmentTier(80)).toBe('reliable');
    expect(getAbandonmentTier(100)).toBe('reliable');
  });

  it('returns moderate for 60 <= score < 80', () => {
    expect(getAbandonmentTier(60)).toBe('moderate');
    expect(getAbandonmentTier(79)).toBe('moderate');
  });

  it('returns inconsistent for 40 <= score < 60', () => {
    expect(getAbandonmentTier(40)).toBe('inconsistent');
    expect(getAbandonmentTier(59)).toBe('inconsistent');
  });

  it('returns volatile for score < 40', () => {
    expect(getAbandonmentTier(39)).toBe('volatile');
    expect(getAbandonmentTier(0)).toBe('volatile');
  });
});

describe('analyzeAgentTaskAbandonment', () => {
  it('returns correct shape with projectId, generatedAt, summary, agents, aiSummary, aiRecommendations', async () => {
    setupDb(
      [{ id: 't1' }],
      [
        makeSession('alice', 'completed'),
        makeSession('alice', 'failed'),
        makeSession('bob', 'completed'),
      ],
    );
    const result = await analyzeAgentTaskAbandonment('proj-1');
    expect(result).toHaveProperty('projectId', 'proj-1');
    expect(result).toHaveProperty('generatedAt');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('agents');
    expect(result).toHaveProperty('aiSummary');
    expect(result).toHaveProperty('aiRecommendations');
  });

  it('summary has all required fields', async () => {
    setupDb(
      [{ id: 't1' }],
      [
        makeSession('alice', 'completed'),
        makeSession('alice', 'failed'),
        makeSession('bob', 'completed'),
      ],
    );
    const result = await analyzeAgentTaskAbandonment('proj-1');
    const { summary } = result;
    expect(summary).toHaveProperty('totalTasksStarted');
    expect(summary).toHaveProperty('totalTasksAbandoned');
    expect(summary).toHaveProperty('avgAbandonmentRate');
    expect(summary).toHaveProperty('mostReliableAgent');
    expect(summary).toHaveProperty('mostVolatileAgent');
    expect(summary).toHaveProperty('lowAbandonmentCount');
  });

  it('agents array is non-empty and each agent has all AgentTaskAbandonmentData fields', async () => {
    setupDb(
      [{ id: 't1' }],
      [
        makeSession('alice', 'completed'),
        makeSession('alice', 'failed'),
        makeSession('bob', 'completed'),
        makeSession('bob', 'cancelled'),
      ],
    );
    const result = await analyzeAgentTaskAbandonment('proj-1');
    expect(result.agents.length).toBeGreaterThan(0);
    for (const agent of result.agents) {
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
    }
  });
});
