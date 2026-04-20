import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeHandoffChainDepth,
  buildChainReport,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type NoteRow,
} from './agent-handoff-chain-depth-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'AI handoff chain summary.',
                recommendations: ['Shorten handoff chains.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

const NOW = new Date('2026-04-20T00:00:00Z');

function makeNote(
  ticketId: string,
  authorId: string,
  content: string,
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
  offsetMs = 0,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content,
    handoffFrom,
    handoffTo,
    createdAt: new Date(NOW.getTime() + offsetMs),
  };
}

type TicketRow = { id: string; title: string };

function makeTicket(id: string, title: string): TicketRow {
  return { id, title };
}

function mockDb(tickets: TicketRow[], notes: NoteRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      return Promise.resolve(notes);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty report
it('empty project returns empty report', async () => {
  mockDb([], []);
  const report = await analyzeHandoffChainDepth('proj-1');
  expect(report.deepChainTickets).toHaveLength(0);
  expect(report.agentStats).toHaveLength(0);
  expect(report.summary.totalTicketsAnalyzed).toBe(0);
  expect(report.summary.avgChainDepth).toBe(0);
  expect(report.summary.maxChainDepth).toBe(0);
  expect(report.summary.mostCommonChainPath).toBe('');
});

// Test 2: single handoff creates chain of depth 1
it('single handoff creates chain of depth 1', () => {
  const tickets = [makeTicket('t1', 'Fix login bug')];
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Passing to AgentB', 'AgentB', 'AgentA', 0),
    makeNote('t1', 'AgentB', 'Fixed it', null, null, 1000),
  ];
  const { deepChainTickets } = buildChainReport(tickets, notes);
  expect(deepChainTickets).toHaveLength(1);
  expect(deepChainTickets[0].chainDepth).toBe(1);
  expect(deepChainTickets[0].agentSequence).toEqual(['AgentA', 'AgentB']);
});

// Test 3: multi-hop chain computes correct depth
it('multi-hop chain computes correct depth', () => {
  const tickets = [makeTicket('t1', 'Complex ticket')];
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Passing to AgentB', 'AgentB', 'AgentA', 0),
    makeNote('t1', 'AgentB', 'Passing to AgentC', 'AgentC', 'AgentB', 1000),
    makeNote('t1', 'AgentC', 'Passing to AgentD', 'AgentD', 'AgentC', 2000),
    makeNote('t1', 'AgentD', 'Done', null, null, 3000),
  ];
  const { deepChainTickets } = buildChainReport(tickets, notes);
  expect(deepChainTickets[0].chainDepth).toBe(3);
  expect(deepChainTickets[0].agentSequence).toEqual(['AgentA', 'AgentB', 'AgentC', 'AgentD']);
});

// Test 4: agentStats passAlongRate calculation
it('agentStats passAlongRate calculation is correct', () => {
  const tickets = [makeTicket('t1', 'Ticket 1'), makeTicket('t2', 'Ticket 2')];
  // AgentB receives 2 times, passes along 1 time
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t1', 'AgentB', 'Pass to C', 'AgentC', 'AgentB', 1000),
    makeNote('t2', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentB', 'Done', null, null, 1000),
  ];
  const { agentStats } = buildChainReport(tickets, notes);
  const agentB = agentStats.find(a => a.personaId === 'AgentB');
  expect(agentB).toBeDefined();
  expect(agentB!.totalHandoffsReceived).toBe(2);
  expect(agentB!.totalHandoffsGiven).toBe(1);
  expect(agentB!.passAlongRate).toBe(50);
});

// Test 5: deepChainTickets sorted by chainDepth desc
it('deepChainTickets sorted by chainDepth descending', () => {
  const tickets = [makeTicket('t1', 'Short chain'), makeTicket('t2', 'Long chain')];
  // t2 has depth 3, t1 has depth 1
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentB', 'Pass to C', 'AgentC', 'AgentB', 1000),
    makeNote('t2', 'AgentC', 'Pass to D', 'AgentD', 'AgentC', 2000),
  ];
  const { deepChainTickets } = buildChainReport(tickets, notes);
  expect(deepChainTickets[0].ticketId).toBe('t2');
  expect(deepChainTickets[0].chainDepth).toBe(3);
  expect(deepChainTickets[1].ticketId).toBe('t1');
  expect(deepChainTickets[1].chainDepth).toBe(1);
});

// Test 6: agentStats sorted by passAlongRate desc
it('agentStats sorted by passAlongRate descending', () => {
  const tickets = [makeTicket('t1', 'T1'), makeTicket('t2', 'T2'), makeTicket('t3', 'T3')];
  // AgentA: receives 1, gives 1 → 100%
  // AgentB: receives 2, gives 1 → 50%
  // AgentC: receives 1, gives 0 → 0%
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentB', 'Pass to C', 'AgentC', 'AgentB', 1000),
    makeNote('t3', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
  ];
  const { agentStats } = buildChainReport(tickets, notes);
  // Check sorted order: descending by passAlongRate
  for (let i = 0; i < agentStats.length - 1; i++) {
    expect(agentStats[i].passAlongRate).toBeGreaterThanOrEqual(agentStats[i + 1].passAlongRate);
  }
});

// Test 7: mostCommonChainPath returns most frequent sequence
it('mostCommonChainPath returns the most frequent sequence', () => {
  const tickets = [makeTicket('t1', 'T1'), makeTicket('t2', 'T2'), makeTicket('t3', 'T3')];
  // Two tickets with AgentA→AgentB path, one with AgentA→AgentC
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Pass', 'AgentB', 'AgentA', 0),
    makeNote('t2', 'AgentA', 'Pass', 'AgentB', 'AgentA', 0),
    makeNote('t3', 'AgentA', 'Pass', 'AgentC', 'AgentA', 0),
  ];
  const { summary } = buildChainReport(tickets, notes);
  expect(summary.mostCommonChainPath).toBe('AgentA → AgentB');
});

// Test 8: AI fallback on error
it('uses fallback when AI call throws error', async () => {
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      },
    };
  });

  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Pass to B', 'AgentB', 'AgentA', 0),
  ];
  mockDb([makeTicket('t1', 'Test ticket')], notes);
  const report = await analyzeHandoffChainDepth('proj-1');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});

// Test 9: handles tickets with no handoffs
it('handles tickets with no handoffs gracefully', () => {
  const tickets = [makeTicket('t1', 'No handoff ticket')];
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'Just a note', null, null, 0),
    makeNote('t1', 'AgentA', 'Another note', null, null, 1000),
  ];
  const { deepChainTickets, agentStats, summary } = buildChainReport(tickets, notes);
  expect(deepChainTickets).toHaveLength(0);
  expect(agentStats).toHaveLength(0);
  expect(summary.avgChainDepth).toBe(0);
  expect(summary.maxChainDepth).toBe(0);
  expect(summary.totalTicketsAnalyzed).toBe(1);
});
