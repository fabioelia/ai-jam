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
import { profileResponseTimes } from './agent-response-time-service.js';

const now = Date.now();
const createdAt = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago creation

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    assignedPersona: 'AgentA',
    status: 'in_progress',
    createdAt,
    updatedAt: new Date(now - 99 * 24 * 60 * 60 * 1000).toISOString(), // 1 day after creation = fast
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

describe('profileResponseTimes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty agentProfiles when no acted-on tickets', async () => {
    mockDb([]);
    const report = await profileResponseTimes('proj-1');
    expect(report.agentProfiles).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
  });

  it('skips backlog tickets from response time calculation', async () => {
    const tickets = [
      makeTicket({ id: 't1', status: 'backlog' }),
      makeTicket({ id: 't2', status: 'backlog' }),
    ];
    mockDb(tickets);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles.find((a) => a.agentName === 'AgentA');
    expect(agent?.ticketsActedOn).toBe(0);
    expect(agent?.unstartedTickets).toBe(2);
  });

  it('responseCategory = fast when avgResponseTimeMs < 24h', async () => {
    // 12 hours response time
    const created = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([makeTicket({ status: 'in_progress', createdAt: created, updatedAt: updated })]);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles[0];
    expect(agent.responseCategory).toBe('fast');
  });

  it('responseCategory = normal when 24h–72h', async () => {
    // 48 hours response time
    const created = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([makeTicket({ status: 'in_progress', createdAt: created, updatedAt: updated })]);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles[0];
    expect(agent.responseCategory).toBe('normal');
  });

  it('responseCategory = slow when > 72h', async () => {
    // 96 hours response time
    const created = new Date(now - 96 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([makeTicket({ status: 'in_progress', createdAt: created, updatedAt: updated })]);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles[0];
    expect(agent.responseCategory).toBe('slow');
  });

  it('responseCategory = slow when unstartedTickets > ticketsActedOn', async () => {
    // 1 acted-on ticket (fast), 2 unstarted → slow due to unstarted > acted
    const created = new Date(now - 6 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([
      makeTicket({ id: 't1', status: 'in_progress', createdAt: created, updatedAt: updated }),
      makeTicket({ id: 't2', status: 'backlog' }),
      makeTicket({ id: 't3', status: 'backlog' }),
    ]);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles[0];
    expect(agent.responseCategory).toBe('slow');
    expect(agent.ticketsActedOn).toBe(1);
    expect(agent.unstartedTickets).toBe(2);
  });

  it('sorts slow agents first', async () => {
    const fastCreated = new Date(now - 6 * 60 * 60 * 1000).toISOString();
    const slowCreated = new Date(now - 96 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'FastAgent', status: 'in_progress', createdAt: fastCreated, updatedAt: updated }),
      makeTicket({ id: 't2', assignedPersona: 'SlowAgent', status: 'in_progress', createdAt: slowCreated, updatedAt: updated }),
    ]);
    const report = await profileResponseTimes('proj-1');
    expect(report.agentProfiles[0].agentName).toBe('SlowAgent');
    expect(report.agentProfiles[0].responseCategory).toBe('slow');
  });

  it('uses fallback recommendation on AI error', async () => {
    const created = new Date(now - 96 * 60 * 60 * 1000).toISOString();
    const updated = new Date(now).toISOString();
    mockDb([makeTicket({ status: 'in_progress', createdAt: created, updatedAt: updated })]);
    const report = await profileResponseTimes('proj-1');
    const agent = report.agentProfiles[0];
    expect(agent.responseCategory).toBe('slow');
    expect(agent.recommendation).toBe('Reduce ticket queue to improve response times');
  });
});
