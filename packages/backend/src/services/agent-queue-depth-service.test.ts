import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    },
  })),
}));

import { db } from '../db/connection.js';
import { monitorQueueDepths } from './agent-queue-depth-service.js';

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    status: 'backlog',
    priority: 'medium',
    assignedPersona: 'AgentA',
    ...overrides,
  };
}

function mockDb(ticketList: ReturnType<typeof makeTicket>[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(ticketList),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('monitorQueueDepths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty agentProfiles when no assigned tickets', async () => {
    mockDb([]);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
    expect(report.overloadedAgents).toBe(0);
    expect(report.idleAgents).toBe(0);
  });

  it('correctly computes queueDepth from backlog+todo only', async () => {
    mockDb([
      makeTicket({ id: 't1', status: 'backlog' }),
      makeTicket({ id: 't2', status: 'todo' }),
      makeTicket({ id: 't3', status: 'in_progress' }),
      makeTicket({ id: 't4', status: 'done' }),
    ]);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles).toHaveLength(1);
    expect(report.agentProfiles[0].queueDepth).toBe(2);
    expect(report.agentProfiles[0].activeTickets).toBe(1);
  });

  it('overflowRisk = low when queueDepth < 3', async () => {
    mockDb([
      makeTicket({ id: 't1', status: 'backlog' }),
      makeTicket({ id: 't2', status: 'todo' }),
    ]);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles[0].overflowRisk).toBe('low');
  });

  it('overflowRisk = medium when queueDepth is 3-6', async () => {
    const tickets = Array.from({ length: 4 }, (_, i) =>
      makeTicket({ id: `t${i}`, status: 'backlog' }),
    );
    mockDb(tickets);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles[0].overflowRisk).toBe('medium');
  });

  it('overflowRisk = high when queueDepth > 6', async () => {
    const tickets = Array.from({ length: 7 }, (_, i) =>
      makeTicket({ id: `t${i}`, status: 'todo' }),
    );
    mockDb(tickets);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles[0].overflowRisk).toBe('high');
  });

  it('sorts high-risk agents first', async () => {
    const ticketList = [
      // AgentA has 1 queued (low risk)
      makeTicket({ id: 't1', status: 'backlog', assignedPersona: 'AgentA' }),
      // AgentB has 7 queued (high risk)
      ...Array.from({ length: 7 }, (_, i) =>
        makeTicket({ id: `tb${i}`, status: 'backlog', assignedPersona: 'AgentB' }),
      ),
    ];
    mockDb(ticketList);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles[0].agentPersona).toBe('AgentB');
    expect(report.agentProfiles[0].overflowRisk).toBe('high');
  });

  it('counts overloadedAgents and idleAgents correctly', async () => {
    const ticketList = [
      // AgentA: 7 queued (high = overloaded)
      ...Array.from({ length: 7 }, (_, i) =>
        makeTicket({ id: `ta${i}`, status: 'backlog', assignedPersona: 'AgentA' }),
      ),
      // AgentB: 1 active, 0 queued (not idle, not overloaded)
      makeTicket({ id: 'tb1', status: 'in_progress', assignedPersona: 'AgentB' }),
      // AgentC: 0 queued, 0 active (idle)
      makeTicket({ id: 'tc1', status: 'done', assignedPersona: 'AgentC' }),
    ];
    mockDb(ticketList);
    const report = await monitorQueueDepths('proj-1');
    expect(report.overloadedAgents).toBe(1);
    // AgentC has done tickets only — done is not queued or active, so queueDepth=0 activeTickets=0 = idle
    expect(report.idleAgents).toBe(1);
  });

  it('uses fallback recommendation on AI error', async () => {
    const tickets = Array.from({ length: 7 }, (_, i) =>
      makeTicket({ id: `t${i}`, status: 'backlog' }),
    );
    mockDb(tickets);
    const report = await monitorQueueDepths('proj-1');
    expect(report.agentProfiles[0].overflowRisk).toBe('high');
    expect(report.agentProfiles[0].recommendation).toBe(
      'Reassign lower-priority tickets to reduce queue depth',
    );
  });
});
