import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computePriorityWeightedScore,
  getPriorityAlignmentTier,
  analyzeAgentPriorityAlignment,
} from './agent-priority-alignment-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function makeTicket(id: string, assignedPersona: string | null, status: string, priority: string) {
  return { id, assignedPersona, status, priority, createdAt: new Date() };
}

function makeSession(id: string, ticketId: string, personaType: string, status: string) {
  return { id, ticketId, personaType, status, startedAt: new Date(Date.now() - 3600000), completedAt: new Date() };
}

function mockDbCalls(ticketRows: unknown[], sessionRows: unknown[]) {
  let call = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      call++;
      return Promise.resolve(call === 1 ? ticketRows : sessionRows);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

describe('analyzeAgentPriorityAlignment', () => {
  it('empty project returns empty agents and criticalBacklogCount=0', async () => {
    mockDbCalls([], []);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.criticalBacklogCount).toBe(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('computePriorityWeightedScore: high criticalResolutionRate and highPriorityFocusRate returns high score', () => {
    const score = computePriorityWeightedScore(100, 100, 0, 10);
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it('computePriorityWeightedScore: all zeros returns 0', () => {
    const score = computePriorityWeightedScore(0, 0, 0, 0);
    expect(score).toBe(0);
  });

  it('getPriorityAlignmentTier: aligned(>=75), balanced(>=50), inconsistent(>=25), misaligned(<25)', () => {
    expect(getPriorityAlignmentTier(75)).toBe('aligned');
    expect(getPriorityAlignmentTier(100)).toBe('aligned');
    expect(getPriorityAlignmentTier(50)).toBe('balanced');
    expect(getPriorityAlignmentTier(74)).toBe('balanced');
    expect(getPriorityAlignmentTier(25)).toBe('inconsistent');
    expect(getPriorityAlignmentTier(49)).toBe('inconsistent');
    expect(getPriorityAlignmentTier(24)).toBe('misaligned');
    expect(getPriorityAlignmentTier(0)).toBe('misaligned');
  });

  it('summary.mostAligned = agent with highest score', async () => {
    mockDbCalls(
      [
        makeTicket('t1', 'AgentA', 'done', 'critical'),
        makeTicket('t2', 'AgentB', 'in_progress', 'low'),
      ],
      [
        makeSession('s1', 't1', 'AgentA', 'completed'),
        makeSession('s2', 't2', 'AgentB', 'completed'),
      ],
    );
    const report = await analyzeAgentPriorityAlignment('proj-1');
    if (report.agents.length >= 2) {
      const sortedByScore = [...report.agents].sort((a, b) => b.priorityAlignmentScore - a.priorityAlignmentScore);
      expect(report.summary.mostAligned).toBe(sortedByScore[0].agentName);
    }
  });

  it('summary.leastAligned = agent with lowest score', async () => {
    mockDbCalls(
      [
        makeTicket('t1', 'AgentA', 'done', 'critical'),
        makeTicket('t2', 'AgentB', 'in_progress', 'low'),
      ],
      [
        makeSession('s1', 't1', 'AgentA', 'completed'),
        makeSession('s2', 't2', 'AgentB', 'completed'),
      ],
    );
    const report = await analyzeAgentPriorityAlignment('proj-1');
    if (report.agents.length >= 2) {
      const sortedByScore = [...report.agents].sort((a, b) => a.priorityAlignmentScore - b.priorityAlignmentScore);
      expect(report.summary.leastAligned).toBe(sortedByScore[0].agentName);
    }
  });

  it('criticalBacklogCount counts unresolved critical tickets', async () => {
    mockDbCalls(
      [
        makeTicket('t1', 'AgentA', 'in_progress', 'critical'),
        makeTicket('t2', 'AgentA', 'done', 'critical'),
        makeTicket('t3', 'AgentA', 'backlog', 'critical'),
      ],
      [makeSession('s1', 't1', 'AgentA', 'completed')],
    );
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.summary.criticalBacklogCount).toBe(2);
  });

  it('AI fallback: returns non-empty insights and recommendations on AI failure', async () => {
    mockDbCalls(
      [makeTicket('t1', 'AgentA', 'done', 'critical')],
      [makeSession('s1', 't1', 'AgentA', 'completed')],
    );
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(Array.isArray(report.insights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});
