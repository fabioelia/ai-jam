import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRouting } from './agent-routing-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Routing strategy: assign by priority and load balance.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(data),
  };
}

function mockDb(ticketData: unknown[]) {
  const dbMock = db as unknown as { select: ReturnType<typeof vi.fn> };
  dbMock.select.mockImplementation(() => makeSelectChain(ticketData));
}

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  priority = 'medium',
  storyPoints: number | null = null,
) {
  return {
    id,
    title: `Ticket ${id}`,
    description: null,
    assignedPersona,
    status,
    priority,
    storyPoints,
    projectId: 'proj-1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeRouting', () => {
  it('returns empty recommendations when no unassigned tickets', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'done', 'critical'),
      makeTicket('t2', 'bob', 'in_progress', 'medium'),
    ]);
    const result = await analyzeRouting('proj-1');
    expect(result.unassignedCount).toBe(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it('returns empty rankedAgents when no known agents', async () => {
    mockDb([
      makeTicket('t1', null, 'backlog', 'medium'),
      makeTicket('t2', null, 'todo', 'high'),
    ]);
    const result = await analyzeRouting('proj-1');
    expect(result.unassignedCount).toBe(2);
    expect(result.recommendations).toHaveLength(2);
    for (const rec of result.recommendations) {
      expect(rec.rankedAgents).toHaveLength(0);
    }
  });

  it('correctly scores agent with priority match (+2 exact, +1 adjacent)', async () => {
    // alice has done 'critical' tickets and has 0 active
    mockDb([
      makeTicket('done1', 'alice', 'done', 'critical'),
      makeTicket('done2', 'alice', 'done', 'high'),
      makeTicket('unassigned1', null, 'backlog', 'critical'), // exact match for alice (+2)
      makeTicket('unassigned2', null, 'backlog', 'medium'),   // adjacent to 'high' (+1)
    ]);
    const result = await analyzeRouting('proj-1');

    const rec1 = result.recommendations.find((r) => r.ticketId === 'unassigned1');
    expect(rec1).toBeDefined();
    const aliceScore1 = rec1!.rankedAgents.find((a) => a.agentName === 'alice');
    expect(aliceScore1).toBeDefined();
    expect(aliceScore1!.score).toBe(2); // exact match, no load penalty

    const rec2 = result.recommendations.find((r) => r.ticketId === 'unassigned2');
    expect(rec2).toBeDefined();
    const aliceScore2 = rec2!.rankedAgents.find((a) => a.agentName === 'alice');
    expect(aliceScore2).toBeDefined();
    expect(aliceScore2!.score).toBe(1); // adjacent match, no load penalty
  });

  it('applies load penalty (0.5 per active ticket)', async () => {
    mockDb([
      makeTicket('active1', 'alice', 'in_progress', 'critical'),
      makeTicket('active2', 'alice', 'backlog', 'critical'),
      makeTicket('unassigned1', null, 'backlog', 'critical'),
    ]);
    const result = await analyzeRouting('proj-1');
    const rec = result.recommendations.find((r) => r.ticketId === 'unassigned1');
    expect(rec).toBeDefined();
    const aliceScore = rec!.rankedAgents.find((a) => a.agentName === 'alice');
    expect(aliceScore).toBeDefined();
    // alice: 0 done tickets → no priority match (0), 2 active tickets → load penalty 1.0
    // score = 0 - 1.0 = -1.0
    expect(aliceScore!.score).toBe(-1);
  });

  it('returns top-2 agents ordered by score desc', async () => {
    mockDb([
      // alice: 2 done critical, 0 active → score 2
      makeTicket('da1', 'alice', 'done', 'critical'),
      makeTicket('da2', 'alice', 'done', 'critical'),
      // bob: 1 done critical, 2 active → score 2 - 1 = 1
      makeTicket('db1', 'bob', 'done', 'critical'),
      makeTicket('bactive1', 'bob', 'in_progress', 'medium'),
      makeTicket('bactive2', 'bob', 'backlog', 'medium'),
      // carol: 0 done critical, 3 active → score 0 - 1.5 = -1.5
      makeTicket('cactive1', 'carol', 'in_progress', 'high'),
      makeTicket('cactive2', 'carol', 'in_progress', 'high'),
      makeTicket('cactive3', 'carol', 'backlog', 'high'),
      // unassigned ticket
      makeTicket('unassigned1', null, 'backlog', 'critical'),
    ]);
    const result = await analyzeRouting('proj-1');
    const rec = result.recommendations.find((r) => r.ticketId === 'unassigned1');
    expect(rec).toBeDefined();
    expect(rec!.rankedAgents).toHaveLength(2);
    expect(rec!.rankedAgents[0].agentName).toBe('alice');
    expect(rec!.rankedAgents[1].agentName).toBe('bob');
  });

  it('handles single agent case (rankedAgents.length === 1)', async () => {
    mockDb([
      makeTicket('da1', 'alice', 'done', 'medium'),
      makeTicket('unassigned1', null, 'backlog', 'medium'),
    ]);
    const result = await analyzeRouting('proj-1');
    const rec = result.recommendations[0];
    expect(rec.rankedAgents).toHaveLength(1);
    expect(rec.rankedAgents[0].agentName).toBe('alice');
  });

  it('skips done tickets in unassigned fetch', async () => {
    mockDb([
      makeTicket('done_unassigned', null, 'done', 'medium'), // should be excluded
      makeTicket('active_unassigned', null, 'backlog', 'medium'), // should be included
      makeTicket('assigned_done', 'alice', 'done', 'medium'),
    ]);
    const result = await analyzeRouting('proj-1');
    expect(result.unassignedCount).toBe(1);
    expect(result.recommendations.find((r) => r.ticketId === 'done_unassigned')).toBeUndefined();
    expect(result.recommendations.find((r) => r.ticketId === 'active_unassigned')).toBeDefined();
  });

  it('falls back to heuristic rationale on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));
    mockDb([
      makeTicket('da1', 'alice', 'done', 'medium'),
      makeTicket('unassigned1', null, 'backlog', 'medium'),
    ]);
    const result = await analyzeRouting('proj-1');
    expect(result.rationale).toBe('Routing based on agent capacity and priority matching');
  });
});
