import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentPerformance } from './agent-performance-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Agents are performing well with balanced routing.' }],
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
  storyPoints: number | null = null,
  priority = 'medium',
) {
  return {
    id,
    assignedPersona,
    status,
    storyPoints,
    priority,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentPerformance', () => {
  it('returns empty agents array when no tickets assigned to personas', async () => {
    mockDb([
      makeTicket('t1', null, 'done'),
      makeTicket('t2', null, 'backlog'),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.topPerformer).toBeNull();
  });

  it('correctly counts completedTickets (only status=done)', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'done'),
      makeTicket('t2', 'alice', 'done'),
      makeTicket('t3', 'alice', 'in_progress'),
      makeTicket('t4', 'alice', 'backlog'),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    const alice = result.agents.find((a) => a.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.completedTickets).toBe(2);
  });

  it('sums storyPointsDelivered for done tickets only', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'done', 5),
      makeTicket('t2', 'alice', 'done', 3),
      makeTicket('t3', 'alice', 'in_progress', 8), // should NOT be counted
      makeTicket('t4', 'alice', 'backlog', 2),      // should NOT be counted
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    const alice = result.agents.find((a) => a.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.totalStoryPointsDelivered).toBe(8); // 5 + 3
  });

  it('calculates completionRate correctly', async () => {
    // 2 done out of 4 total → 50.0%
    mockDb([
      makeTicket('t1', 'alice', 'done'),
      makeTicket('t2', 'alice', 'done'),
      makeTicket('t3', 'alice', 'backlog'),
      makeTicket('t4', 'alice', 'todo'),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    const alice = result.agents.find((a) => a.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.completionRate).toBe(50);
  });

  it("marks agent as 'high' performer when completionRate > 70%", async () => {
    // 8 done out of 10 total → 80%
    mockDb([
      ...Array.from({ length: 8 }, (_, i) => makeTicket(`d${i}`, 'alice', 'done')),
      makeTicket('b1', 'alice', 'backlog'),
      makeTicket('b2', 'alice', 'backlog'),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    const alice = result.agents.find((a) => a.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.performanceTier).toBe('high');
  });

  it("marks agent as 'low' performer when completionRate < 40%", async () => {
    // 1 done out of 5 total → 20%
    mockDb([
      makeTicket('t1', 'alice', 'done'),
      makeTicket('t2', 'alice', 'backlog'),
      makeTicket('t3', 'alice', 'backlog'),
      makeTicket('t4', 'alice', 'in_progress'),
      makeTicket('t5', 'alice', 'review'),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    const alice = result.agents.find((a) => a.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.performanceTier).toBe('low');
  });

  it('identifies topPerformer by highest completionRate', async () => {
    // alice: 4/5 = 80%, bob: 1/5 = 20%
    mockDb([
      ...Array.from({ length: 4 }, (_, i) => makeTicket(`da${i}`, 'alice', 'done')),
      makeTicket('ba1', 'alice', 'backlog'),
      makeTicket('db1', 'bob', 'done'),
      ...Array.from({ length: 4 }, (_, i) => makeTicket(`bb${i}`, 'bob', 'backlog')),
    ]);
    const result = await analyzeAgentPerformance('proj-1');
    expect(result.topPerformer).toBe('alice');
  });

  it('falls back to heuristic insight on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));
    mockDb([makeTicket('t1', 'alice', 'done', 3)]);
    const result = await analyzeAgentPerformance('proj-1');
    expect(result.insight).toBe('Performance analysis based on ticket completion data');
  });
});
