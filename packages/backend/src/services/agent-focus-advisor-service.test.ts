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
import { adviseFocus } from './agent-focus-advisor-service.js';

const now = Date.now();
const fresh = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
const stale = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
const olderStale = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    title: 'Test ticket',
    assignedPersona: 'AgentA',
    status: 'in_progress',
    updatedAt: fresh,
    ...overrides,
  };
}

function mockDb(tickets: ReturnType<typeof makeTicket>[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(tickets),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('adviseFocus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty agentAdvice when no non-done tickets', async () => {
    mockDb([]);
    const report = await adviseFocus('proj-1');
    expect(report.agentAdvice).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
  });

  it('focusRisk = overloaded when inProgressCount >= 4', async () => {
    const tickets = Array.from({ length: 4 }, (_, i) =>
      makeTicket({ id: `t${i}`, assignedPersona: 'AgentA', status: 'in_progress', updatedAt: fresh }),
    );
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.focusRisk).toBe('overloaded');
    expect(agent?.inProgressCount).toBe(4);
  });

  it('focusRisk = stale when staleCount >= 2 and inProgressCount < 4', async () => {
    const tickets = [
      makeTicket({ id: 't1', status: 'in_progress', updatedAt: stale }),
      makeTicket({ id: 't2', status: 'todo', updatedAt: stale }),
    ];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.focusRisk).toBe('stale');
    expect(agent?.staleCount).toBe(2);
  });

  it('focusRisk = idle when inProgressCount = 0 and no stale', async () => {
    const tickets = [makeTicket({ status: 'todo', updatedAt: fresh })];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.focusRisk).toBe('idle');
  });

  it('focusRisk = balanced otherwise', async () => {
    const tickets = [
      makeTicket({ id: 't1', status: 'in_progress', updatedAt: fresh }),
      makeTicket({ id: 't2', status: 'in_progress', updatedAt: fresh }),
    ];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.focusRisk).toBe('balanced');
  });

  it('sorts overloaded agents first', async () => {
    const tickets = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeTicket({ id: `over${i}`, assignedPersona: 'AgentOverloaded', status: 'in_progress', updatedAt: fresh }),
      ),
      makeTicket({ id: 'idle1', assignedPersona: 'AgentIdle', status: 'todo', updatedAt: fresh }),
    ];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    expect(report.agentAdvice[0].agentName).toBe('AgentOverloaded');
    expect(report.agentAdvice[0].focusRisk).toBe('overloaded');
  });

  it('topStaleTicket is oldest stale ticket', async () => {
    const tickets = [
      makeTicket({ id: 'newer-stale', title: 'Newer stale', status: 'todo', updatedAt: stale }),
      makeTicket({ id: 'oldest-stale', title: 'Oldest stale', status: 'todo', updatedAt: olderStale }),
    ];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.topStaleTicket?.id).toBe('oldest-stale');
  });

  it('uses fallback recommendation on AI error', async () => {
    const tickets = [
      makeTicket({ id: 's1', status: 'todo', updatedAt: stale }),
      makeTicket({ id: 's2', status: 'todo', updatedAt: stale }),
    ];
    mockDb(tickets);
    const report = await adviseFocus('proj-1');
    const agent = report.agentAdvice.find((a) => a.agentName === 'AgentA');
    expect(agent?.recommendation).toBe('Clear stale tickets before starting new work');
  });
});
