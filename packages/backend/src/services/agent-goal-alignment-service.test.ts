import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeGoalAlignment } from './agent-goal-alignment-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function makeTicket(
  assignedPersona: string | null,
  epicId: string | null = null,
  featureId: string | null = null,
) {
  return { assignedPersona, epicId, featureId };
}

function setupDb(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeGoalAlignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when no done tickets', async () => {
    setupDb([]);
    const report = await analyzeGoalAlignment('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.mostAlignedAgent).toBeNull();
  });

  it('fully aligned agent: all tasks have epicId', async () => {
    setupDb([
      makeTicket('AgentA', 'epic-1', null),
      makeTicket('AgentA', 'epic-2', null),
      makeTicket('AgentA', 'epic-3', null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentA')!;
    expect(agent.tasksCompleted).toBe(3);
    expect(agent.tasksInScope).toBe(3);
    expect(agent.tasksOutOfScope).toBe(0);
    expect(agent.alignmentScore).toBe(100);
    expect(agent.classification).toBe('aligned');
  });

  it('fully drifted agent: no tasks linked to epic or feature', async () => {
    setupDb([
      makeTicket('AgentB', null, null),
      makeTicket('AgentB', null, null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentB')!;
    expect(agent.tasksInScope).toBe(0);
    expect(agent.tasksOutOfScope).toBe(2);
    expect(agent.alignmentScore).toBe(0);
    expect(agent.classification).toBe('drifted');
  });

  it('partial alignment: mixed in-scope and out-of-scope tasks', async () => {
    setupDb([
      makeTicket('AgentC', 'epic-1', null),
      makeTicket('AgentC', null, null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentC')!;
    expect(agent.tasksInScope).toBe(1);
    expect(agent.tasksOutOfScope).toBe(1);
    expect(agent.alignmentScore).toBe(50);
    expect(agent.classification).toBe('partial');
  });

  it('driftRate is tasksOutOfScope/tasksCompleted rounded to 2 decimals', async () => {
    setupDb([
      makeTicket('AgentD', 'epic-1', null),
      makeTicket('AgentD', null, null),
      makeTicket('AgentD', null, null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentD')!;
    expect(agent.driftRate).toBeCloseTo(0.67, 2);
  });

  it('classification thresholds: >=80 aligned, >=50 partial, <50 drifted', async () => {
    setupDb([
      makeTicket('AgentAligned', 'epic-1', null),
      makeTicket('AgentAligned', 'epic-2', null),
      makeTicket('AgentAligned', 'epic-3', null),
      makeTicket('AgentAligned', 'epic-4', null),
      makeTicket('AgentAligned', null, null),
      makeTicket('AgentPartial', 'epic-1', null),
      makeTicket('AgentPartial', null, null),
      makeTicket('AgentDrifted', null, null),
      makeTicket('AgentDrifted', null, null),
      makeTicket('AgentDrifted', null, null),
      makeTicket('AgentDrifted', 'epic-1', null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const aligned = report.agents.find((a) => a.agentPersona === 'AgentAligned')!;
    const partial = report.agents.find((a) => a.agentPersona === 'AgentPartial')!;
    const drifted = report.agents.find((a) => a.agentPersona === 'AgentDrifted')!;
    expect(aligned.classification).toBe('aligned');
    expect(partial.classification).toBe('partial');
    expect(drifted.classification).toBe('drifted');
  });

  it('empty project with no done tickets returns zero summary', async () => {
    setupDb([]);
    const report = await analyzeGoalAlignment('proj-empty');
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.avgAlignmentScore).toBe(0);
    expect(report.summary.driftedAgents).toBe(0);
    expect(report.summary.mostAlignedAgent).toBeNull();
  });

  it('summary stats: totalAgents, avgAlignmentScore, driftedAgents, mostAlignedAgent', async () => {
    setupDb([
      makeTicket('AgentX', 'epic-1', null),  // alignmentScore=100, aligned
      makeTicket('AgentY', null, null),        // alignmentScore=0, drifted
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    expect(report.summary.totalAgents).toBe(2);
    expect(report.summary.avgAlignmentScore).toBe(50);
    expect(report.summary.driftedAgents).toBe(1);
    expect(report.summary.mostAlignedAgent).toBe('AgentX');
  });

  it('agents sorted by alignmentScore desc, then tasksCompleted desc within tie', async () => {
    setupDb([
      makeTicket('AgentLow', null, null),      // score=0
      makeTicket('AgentHigh', 'epic-1', null), // score=100
      makeTicket('AgentMid', 'epic-1', null),  // score=50
      makeTicket('AgentMid', null, null),
    ]);
    const report = await analyzeGoalAlignment('proj-1');
    const scores = report.agents.map((a) => a.alignmentScore);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
    expect(report.agents[0].agentPersona).toBe('AgentHigh');
  });
});
