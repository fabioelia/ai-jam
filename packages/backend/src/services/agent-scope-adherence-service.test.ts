import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentScopeAdherence,
  buildScopeMetrics,
  adherenceLevel,
  computeAdherenceScore,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type NoteRow,
} from './agent-scope-adherence-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ summary: 'AI scope summary.', recommendations: ['Tighten ticket scope.'] }) }],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

function makeTicket(id: string, assignedPersona: string | null, status = 'in_progress'): TicketRow {
  return { id, assignedPersona, status };
}

function makeNote(
  ticketId: string,
  authorId: string,
  content = 'some note content',
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content,
    handoffFrom,
    handoffTo,
    createdAt: new Date(),
  };
}

function mockDb(
  ticketList: TicketRow[],
  noteList: NoteRow[],
) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketList);
      return Promise.resolve(noteList);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], []);
  const report = await analyzeAgentScopeAdherence('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.summary.avgAdherenceScore).toBe(0);
  expect(report.summary.mostAdherent).toBeNull();
  expect(report.summary.leastAdherent).toBeNull();
  expect(report.summary.systemReworkRate).toBe(0);
});

// Test 2: adherenceScore weights 30/40/20/10 correct calculation
it('computes adherenceScore with correct weights (30/40/20/10)', () => {
  const score = computeAdherenceScore(20, 10, 5, 4);
  // (100-20)*0.30 + (100-10)*0.40 + (100-5)*0.20 + min(4,10)*10*0.10
  // 80*0.30 + 90*0.40 + 95*0.20 + 4*10*0.10
  // 24 + 36 + 19 + 4 = 83
  expect(score).toBeCloseTo(83, 0);
});

// Test 3: level tiers: excellent>=80, good>=60, fair>=40, poor<40
it('assigns adherenceLevel tiers correctly', () => {
  expect(adherenceLevel(80)).toBe('excellent');
  expect(adherenceLevel(85)).toBe('excellent');
  expect(adherenceLevel(79)).toBe('good');
  expect(adherenceLevel(60)).toBe('good');
  expect(adherenceLevel(59)).toBe('fair');
  expect(adherenceLevel(40)).toBe('fair');
  expect(adherenceLevel(39)).toBe('poor');
  expect(adherenceLevel(0)).toBe('poor');
});

// Test 4: overEngineeringPct calculation
it('computes overEngineeringPct as tickets with >3 agent notes / total', () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentA', 'done'),
  ];
  const notes: NoteRow[] = [
    // t1: AgentA has 4 notes (>3 = over-engineering)
    makeNote('t1', 'AgentA'),
    makeNote('t1', 'AgentA'),
    makeNote('t1', 'AgentA'),
    makeNote('t1', 'AgentA'),
    // t2: AgentA has 1 note (not over-engineering)
    makeNote('t2', 'AgentA'),
  ];
  const metrics = buildScopeMetrics(tickets, notes);
  const agentA = metrics.find(m => m.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  // 1 out of 2 tickets is over-engineered = 50%
  expect(agentA!.overEngineeringPct).toBe(50);
});

// Test 5: underDeliveryPct calculation
it('computes underDeliveryPct as done tickets with <2 agent notes / total', () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentB', 'done'),
    makeTicket('t2', 'AgentB', 'done'),
  ];
  const notes: NoteRow[] = [
    // t1: AgentB has 1 note (under-delivery: done but <2 notes)
    makeNote('t1', 'AgentB'),
    // t2: AgentB has 2 notes (meets threshold)
    makeNote('t2', 'AgentB'),
    makeNote('t2', 'AgentB'),
  ];
  const metrics = buildScopeMetrics(tickets, notes);
  const agentB = metrics.find(m => m.personaId === 'AgentB');
  expect(agentB).toBeDefined();
  // 1 out of 2 done tickets under-delivered = 50%
  expect(agentB!.underDeliveryPct).toBe(50);
});

// Test 6: reworkPct calculation
it('computes reworkPct as in_progress tickets agent worked on / total worked', () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentC', 'in_progress'), // rework: still in progress and has notes
    makeTicket('t2', 'AgentC', 'done'),          // not rework
  ];
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentC'),
    makeNote('t2', 'AgentC'),
  ];
  const metrics = buildScopeMetrics(tickets, notes);
  const agentC = metrics.find(m => m.personaId === 'AgentC');
  expect(agentC).toBeDefined();
  // 1 out of 2 worked tickets is in_progress = 50%
  expect(agentC!.reworkPct).toBe(50);
});

// Test 7: AI fallback on error
it('returns fallback AI content when AI call fails', async () => {
  const AnthropicMock = Anthropic as unknown as ReturnType<typeof vi.fn>;
  AnthropicMock.mockImplementationOnce(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    },
  }));

  const tickets: TicketRow[] = [makeTicket('t1', 'AgentD', 'done')];
  const notes: NoteRow[] = [makeNote('t1', 'AgentD'), makeNote('t1', 'AgentD')];
  mockDb(tickets, notes);

  const report = await analyzeAgentScopeAdherence('proj-1');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});

// Test 8: sorted by adherenceScore desc
it('sorts agents by adherenceScore descending', () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentX', 'done'),
    makeTicket('t2', 'AgentX', 'done'),
    makeTicket('t3', 'AgentY', 'done'),
    makeTicket('t4', 'AgentY', 'done'),
  ];
  const notes: NoteRow[] = [
    // AgentX: 1 note per ticket, done (good behavior, low under-delivery)
    makeNote('t1', 'AgentX'),
    makeNote('t1', 'AgentX'),
    makeNote('t2', 'AgentX'),
    makeNote('t2', 'AgentX'),
    // AgentY: many notes on t3 (over-engineering), 1 note on t4 (under-delivery)
    makeNote('t3', 'AgentY'),
    makeNote('t3', 'AgentY'),
    makeNote('t3', 'AgentY'),
    makeNote('t3', 'AgentY'),
    makeNote('t4', 'AgentY'),
  ];
  const metrics = buildScopeMetrics(tickets, notes);
  expect(metrics.length).toBeGreaterThanOrEqual(2);
  // Scores should be sorted descending
  for (let i = 0; i < metrics.length - 1; i++) {
    expect(metrics[i].adherenceScore).toBeGreaterThanOrEqual(metrics[i + 1].adherenceScore);
  }
  // AgentX should score higher than AgentY
  const agentXScore = metrics.find(m => m.personaId === 'AgentX')!.adherenceScore;
  const agentYScore = metrics.find(m => m.personaId === 'AgentY')!.adherenceScore;
  expect(agentXScore).toBeGreaterThan(agentYScore);
});
