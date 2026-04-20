import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentThroughputRate,
  buildThroughputProfiles,
  computeThroughputTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type SessionRow,
} from './agent-throughput-rate-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI throughput summary.',
        recommendations: ['Increase ticket throughput.'],
      }),
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { db } from '../db/connection.js';

function makeTicket(id: string, assignedPersona: string, status: string): TicketRow {
  return { id, assignedPersona, status };
}

function makeSession(
  ticketId: string,
  personaType: string,
  startedAt: Date | null = new Date('2026-01-01T10:00:00Z'),
): SessionRow {
  return { ticketId, personaType, startedAt };
}

function mockDb(ticketRows: TicketRow[], sessionRows: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(sessionRows);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty agents array
it('empty project returns empty agents array', async () => {
  mockDb([], []);
  const report = await analyzeAgentThroughputRate('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.highestThroughputAgent).toBeNull();
  expect(report.idleAgents).toBe(0);
  expect(report.avgTicketsPerDay).toBe(0);
});

// Test 2: idle agent (0 tickets) gets 'idle' tier
it('idle agent with 0 tickets gets idle tier', () => {
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentA', 'in_progress')];
  const sessions: SessionRow[] = [makeSession('t1', 'AgentA', new Date('2026-01-01'))];
  const profiles = buildThroughputProfiles(tickets, sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agentA.throughputTier).toBe('idle');
  expect(agentA.ticketsClosed).toBe(0);
});

// Test 3: high throughput agent (>=3/day) gets 'high' tier
it('high throughput agent gets high tier', () => {
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentA', 'done'),
    makeTicket('t3', 'AgentA', 'done'),
  ];
  const day = new Date('2026-01-01T10:00:00Z');
  const sessions: SessionRow[] = [
    makeSession('t1', 'AgentA', day),
    makeSession('t2', 'AgentA', day),
    makeSession('t3', 'AgentA', day),
  ];
  const profiles = buildThroughputProfiles(ticketRows, sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agentA.throughputTier).toBe('high');
  expect(agentA.ticketsPerDay).toBeGreaterThanOrEqual(3);
});

// Test 4: moderate throughput agent
it('moderate throughput agent (>=1/day) gets moderate tier', () => {
  expect(computeThroughputTier(1)).toBe('moderate');
  expect(computeThroughputTier(2.5)).toBe('moderate');
});

// Test 5: ticketsPerSession calculation
it('ticketsPerSession is calculated correctly', () => {
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentA', 'done'),
  ];
  const day = new Date('2026-01-01T10:00:00Z');
  const sessions: SessionRow[] = [
    makeSession('t1', 'AgentA', day),
    makeSession('t2', 'AgentA', day),
    makeSession(null, 'AgentA', day),
    makeSession(null, 'AgentA', day),
  ];
  const profiles = buildThroughputProfiles(ticketRows, sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  // 2 tickets closed / 4 sessions = 0.5
  expect(agentA.ticketsPerSession).toBe(0.5);
});

// Test 6: highestThroughputAgent correctly selected
it('highestThroughputAgent is agent with highest ticketsPerDay', async () => {
  const day1 = new Date('2026-01-01T10:00:00Z');
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentB', 'done'),
    makeTicket('t3', 'AgentB', 'done'),
    makeTicket('t4', 'AgentB', 'done'),
  ];
  const sessions: SessionRow[] = [
    makeSession('t1', 'AgentA', day1),
    makeSession('t2', 'AgentB', day1),
    makeSession('t3', 'AgentB', day1),
    makeSession('t4', 'AgentB', day1),
  ];
  mockDb(ticketRows, sessions);
  const report = await analyzeAgentThroughputRate('proj-1');
  expect(report.highestThroughputAgent).toBe('AgentB');
});

// Test 7: idleAgents count correct
it('idleAgents count is correct', async () => {
  const day = new Date('2026-01-01T10:00:00Z');
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'in_progress'),
    makeTicket('t2', 'AgentB', 'done'),
    makeTicket('t3', 'AgentC', 'in_progress'),
  ];
  const sessions: SessionRow[] = [
    makeSession('t1', 'AgentA', day),
    makeSession('t2', 'AgentB', day),
    makeSession('t3', 'AgentC', day),
  ];
  mockDb(ticketRows, sessions);
  const report = await analyzeAgentThroughputRate('proj-2');
  // AgentA and AgentC have 0 tickets closed = idle
  expect(report.idleAgents).toBe(2);
});

// Test 8: AI summary fallback when AI unavailable
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI unavailable'));
  mockDb([], []);
  const report = await analyzeAgentThroughputRate('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
