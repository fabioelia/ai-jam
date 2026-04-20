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
import { detectAgentStalls, computeSeverity } from './agent-stall-detector-service.js';

const NOW = new Date('2026-04-20T12:00:00Z');

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    title: 'Test Ticket',
    status: 'in_progress',
    assignedPersona: 'AgentA',
    updatedAt: new Date(NOW.getTime() - 36 * 60 * 60 * 1000).toISOString(), // 36h ago
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

vi.setSystemTime(NOW);

describe('computeSeverity', () => {
  it('critical >= 72h', () => expect(computeSeverity(72)).toBe('critical'));
  it('high >= 48h', () => expect(computeSeverity(48)).toBe('high'));
  it('moderate >= 24h', () => expect(computeSeverity(24)).toBe('moderate'));
  it('low >= 12h', () => expect(computeSeverity(12)).toBe('low'));
});

describe('detectAgentStalls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty report when no stalled tickets', async () => {
    mockDb([]);
    const report = await detectAgentStalls('proj-1');
    expect(report.totalStalledTickets).toBe(0);
    expect(report.agentSummaries).toHaveLength(0);
    expect(report.mostStalledAgent).toBeNull();
    expect(report.aiRecommendation).toBe(
      'Review stalled tickets for missing context or blocking dependencies. Reassign or add handoff notes to unblock.',
    );
  });

  it('excludes tickets stalled < 12h', async () => {
    mockDb([
      makeTicket({ updatedAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000).toISOString() }),
    ]);
    const report = await detectAgentStalls('proj-1');
    expect(report.totalStalledTickets).toBe(0);
  });

  it('includes tickets stalled >= 12h with correct severity', async () => {
    mockDb([makeTicket()]);
    const report = await detectAgentStalls('proj-1');
    expect(report.totalStalledTickets).toBe(1);
    expect(report.agentSummaries[0].stalledTickets[0].severity).toBe('moderate');
  });

  it('counts criticalStalls correctly', async () => {
    mockDb([
      makeTicket({ id: 't1', updatedAt: new Date(NOW.getTime() - 80 * 60 * 60 * 1000).toISOString() }),
      makeTicket({ id: 't2', updatedAt: new Date(NOW.getTime() - 36 * 60 * 60 * 1000).toISOString() }),
    ]);
    const report = await detectAgentStalls('proj-1');
    expect(report.criticalStalls).toBe(1);
  });

  it('sorts agentSummaries by stalledCount descending', async () => {
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'AgentA' }),
      makeTicket({ id: 't2', assignedPersona: 'AgentB' }),
      makeTicket({ id: 't3', assignedPersona: 'AgentB' }),
    ]);
    const report = await detectAgentStalls('proj-1');
    expect(report.agentSummaries[0].agentPersona).toBe('AgentB');
    expect(report.agentSummaries[1].agentPersona).toBe('AgentA');
  });

  it('mostStalledAgent = agent with highest stalledCount', async () => {
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'AgentA' }),
      makeTicket({ id: 't2', assignedPersona: 'AgentB' }),
      makeTicket({ id: 't3', assignedPersona: 'AgentB' }),
    ]);
    const report = await detectAgentStalls('proj-1');
    expect(report.mostStalledAgent).toBe('AgentB');
  });

  it('computes avgStalledHours and worstStallHours per agent', async () => {
    const t1 = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 24h
    const t2 = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString(); // 48h
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'AgentA', updatedAt: t1 }),
      makeTicket({ id: 't2', assignedPersona: 'AgentA', updatedAt: t2 }),
    ]);
    const report = await detectAgentStalls('proj-1');
    const summary = report.agentSummaries[0];
    expect(summary.avgStalledHours).toBeCloseTo(36, 0);
    expect(summary.worstStallHours).toBeCloseTo(48, 0);
  });

  it('uses fallback recommendation when AI unavailable', async () => {
    mockDb([makeTicket()]);
    const report = await detectAgentStalls('proj-1');
    expect(report.aiRecommendation).toBe(
      'Review stalled tickets for missing context or blocking dependencies. Reassign or add handoff notes to unblock.',
    );
  });
});
