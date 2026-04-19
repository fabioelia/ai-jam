import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWorkload } from './workload-balancer-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Team workload is well distributed.' }],
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

const fakeProject = [{ id: 'proj-1', name: 'Test Project' }];

function mockDb(projectData: unknown[], ticketData: unknown[]) {
  const dbMock = db as unknown as { select: ReturnType<typeof vi.fn> };
  let callCount = 0;
  dbMock.select.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return makeSelectChain(projectData);
    return makeSelectChain(ticketData);
  });
}

function makeTicket(id: string, assignee: string | null, storyPoints: number, priority = 'medium') {
  return { id, title: `Ticket ${id}`, assignedPersona: assignee, storyPoints, priority, projectId: 'proj-1', featureId: null, status: 'todo' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeWorkload', () => {
  it('returns empty assigneeLoads when no tickets assigned', async () => {
    mockDb(fakeProject, [makeTicket('t1', null, 3)]);
    const result = await analyzeWorkload('proj-1');
    expect(result).not.toBeNull();
    expect(result!.assigneeLoads).toHaveLength(0);
  });

  it('calculates load score correctly (ticketCount + 0.5*storyPoints)', async () => {
    // alice: 2 tickets, 6 total SP → score = 2 + 3 = 5
    mockDb(fakeProject, [
      makeTicket('t1', 'alice', 4),
      makeTicket('t2', 'alice', 2),
    ]);
    const result = await analyzeWorkload('proj-1');
    expect(result).not.toBeNull();
    const alice = result!.assigneeLoads.find((l) => l.assignee === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.loadScore).toBe(5); // 2*1 + 6*0.5
  });

  it("marks assignee as 'overloaded' when load > mean + 1.5*stddev", async () => {
    // alice: 20 tickets, 0 SP → score 20
    // bob,carol,dave: 1 ticket, 0 SP → score 1 each
    // N=4: mean=5.75, stddev≈8.23, threshold_high≈18.09 → alice(20) overloaded
    const tickets = [
      ...Array.from({ length: 20 }, (_, i) => makeTicket(`ta${i}`, 'alice', 0)),
      makeTicket('tb1', 'bob', 0),
      makeTicket('tc1', 'carol', 0),
      makeTicket('td1', 'dave', 0),
    ];
    mockDb(fakeProject, tickets);
    const result = await analyzeWorkload('proj-1');
    const alice = result!.assigneeLoads.find((l) => l.assignee === 'alice');
    expect(alice!.status).toBe('overloaded');
  });

  it("marks assignee as 'underloaded' when load < mean - 1.5*stddev", async () => {
    // alice: 5 tickets, 0 SP → score 5
    // bob,carol,dave,eve: 10 tickets each → score 10
    // N=5: mean=9, variance=4, stddev=2, threshold_low=6 → alice(5) underloaded
    const tickets = [
      ...Array.from({ length: 5 }, (_, i) => makeTicket(`ta${i}`, 'alice', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tb${i}`, 'bob', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tc${i}`, 'carol', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`td${i}`, 'dave', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`te${i}`, 'eve', 0)),
    ];
    mockDb(fakeProject, tickets);
    const result = await analyzeWorkload('proj-1');
    const alice = result!.assigneeLoads.find((l) => l.assignee === 'alice');
    expect(alice!.status).toBe('underloaded');
  });

  it('generates recommendation from overloaded to underloaded', async () => {
    // alice: overloaded (20 tickets), bob: underloaded (1 ticket)
    // carol,dave,eve,frank: 10 each (balanced middle)
    // N=6: mean≈10.17, stddev≈5.49, high≈18.41, low≈1.93 → alice overloaded, bob underloaded
    const tickets = [
      ...Array.from({ length: 20 }, (_, i) => makeTicket(`ta${i}`, 'alice', 0, 'medium')),
      makeTicket('tb1', 'bob', 0),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tc${i}`, 'carol', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`td${i}`, 'dave', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`te${i}`, 'eve', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tf${i}`, 'frank', 0)),
    ];
    mockDb(fakeProject, tickets);
    const result = await analyzeWorkload('proj-1');
    expect(result!.recommendations.length).toBeGreaterThan(0);
    const rec = result!.recommendations[0];
    expect(rec.fromAssignee).toBe('alice');
    expect(rec.toAssignee).toBe('bob');
  });

  it("sets overallBalance = 'well-balanced' when all balanced", async () => {
    // alice,bob,carol: same load → stddev=0 → all balanced
    mockDb(fakeProject, [
      makeTicket('t1', 'alice', 3),
      makeTicket('t2', 'bob', 3),
      makeTicket('t3', 'carol', 3),
    ]);
    const result = await analyzeWorkload('proj-1');
    expect(result!.overallBalance).toBe('well-balanced');
  });

  it("sets overallBalance = 'severe-imbalance' with 2+ outliers", async () => {
    // alice overloaded + bob underloaded = 2 outliers → severe-imbalance
    // Same distribution as recommendation test
    const tickets = [
      ...Array.from({ length: 20 }, (_, i) => makeTicket(`ta${i}`, 'alice', 0)),
      makeTicket('tb1', 'bob', 0),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tc${i}`, 'carol', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`td${i}`, 'dave', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`te${i}`, 'eve', 0)),
      ...Array.from({ length: 10 }, (_, i) => makeTicket(`tf${i}`, 'frank', 0)),
    ];
    mockDb(fakeProject, tickets);
    const result = await analyzeWorkload('proj-1');
    expect(result!.overallBalance).toBe('severe-imbalance');
  });

  it('falls back to heuristic narrative on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));
    mockDb(fakeProject, [makeTicket('t1', 'alice', 3)]);
    const result = await analyzeWorkload('proj-1');
    expect(result!.narrative).toBe('Workload analysis based on ticket distribution');
  });
});
