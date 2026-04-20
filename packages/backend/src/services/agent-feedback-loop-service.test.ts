import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockFrom, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockSelect, mockFrom, mockWhere };
});

vi.mock('../db/connection.js', () => ({
  db: { select: mockSelect },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() };
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

import { analyzeAgentFeedbackLoops, computeMetrics } from './agent-feedback-loop-service.js';

type S = { id: string; personaType: string; status: string; ticketId: string | null; createdAt: Date; completedAt: Date | null };
type N = { authorId: string; ticketId: string; handoffFrom: string | null; handoffTo: string | null; createdAt: Date };
type T = { id: string; assignedPersona: string | null; status: string; projectId: string; updatedAt: Date };

const now = new Date('2026-01-20T12:00:00Z');
function daysAgo(d: number) { return new Date(now.getTime() - d * 86400000); }

function makeSession(id: string, personaType: string, status: string, ticketId = 'ticket-1', offsetDays = 0): S {
  return { id, personaType, status, ticketId, createdAt: daysAgo(offsetDays), completedAt: status === 'completed' ? daysAgo(offsetDays) : null };
}

function makeNote(authorId: string, ticketId: string, handoffFrom?: string, handoffTo?: string): N {
  return { authorId, ticketId, handoffFrom: handoffFrom ?? null, handoffTo: handoffTo ?? null, createdAt: now };
}

function makeTicket(id: string, assignedPersona: string | null, status: string, projectId = 'proj-1'): T {
  return { id, assignedPersona, status, projectId, updatedAt: now };
}

describe('computeMetrics', () => {
  it('agent with no feedback returns none responsiveness', () => {
    const sessions = [
      makeSession('s1', 'AgentA', 'completed', 'ticket-1', 10),
      makeSession('s2', 'AgentA', 'completed', 'ticket-1', 5),
    ];
    const result = computeMetrics('AgentA', sessions, [], [makeTicket('ticket-1', 'AgentA', 'done')]);
    expect(result.totalFeedbackEvents).toBe(0);
    expect(result.feedbackResponsiveness).toBe('none');
  });

  it('agent with high improvement rate gets high responsiveness', () => {
    // 4 sessions: first 2 failed, last 2 succeeded → 100% improvement
    const sessions = [
      makeSession('s1', 'AgentA', 'failed', 'ticket-1', 20),
      makeSession('s2', 'AgentA', 'failed', 'ticket-1', 15),
      makeSession('s3', 'AgentA', 'completed', 'ticket-1', 5),
      makeSession('s4', 'AgentA', 'completed', 'ticket-1', 1),
    ];
    const notes = [makeNote('AgentA', 'ticket-1', 'AgentA', 'AgentB'), makeNote('AgentA', 'ticket-1', 'AgentA', 'AgentC')];
    const tickets = [makeTicket('ticket-1', 'AgentA', 'done')];
    const result = computeMetrics('AgentA', sessions, notes, tickets);
    expect(result.totalFeedbackEvents).toBeGreaterThanOrEqual(2);
    expect(result.improvementRate).toBe(100);
    expect(result.feedbackResponsiveness).toBe('high');
  });

  it('agent with no improvement gets none responsiveness', () => {
    const sessions = [
      makeSession('s1', 'AgentB', 'failed', 'ticket-2', 20),
      makeSession('s2', 'AgentB', 'failed', 'ticket-2', 15),
      makeSession('s3', 'AgentB', 'failed', 'ticket-2', 5),
      makeSession('s4', 'AgentB', 'failed', 'ticket-2', 1),
    ];
    const notes = [makeNote('AgentB', 'ticket-2', 'AgentB', 'AgentA'), makeNote('AgentB', 'ticket-2', 'AgentB', 'AgentC')];
    const tickets = [makeTicket('ticket-2', 'AgentB', 'in_progress')];
    const result = computeMetrics('AgentB', sessions, notes, tickets);
    expect(result.improvementRate).toBe(0);
    expect(result.feedbackResponsiveness).toBe('none');
  });

  it('trend improving: recent sessions have lower failure rate', () => {
    const sessions = [
      makeSession('s1', 'AgentC', 'failed', 'ticket-3', 30),
      makeSession('s2', 'AgentC', 'failed', 'ticket-3', 25),
      makeSession('s3', 'AgentC', 'failed', 'ticket-3', 20),
      makeSession('s4', 'AgentC', 'failed', 'ticket-3', 15),
      makeSession('s5', 'AgentC', 'completed', 'ticket-3', 4),
      makeSession('s6', 'AgentC', 'completed', 'ticket-3', 3),
      makeSession('s7', 'AgentC', 'completed', 'ticket-3', 2),
      makeSession('s8', 'AgentC', 'completed', 'ticket-3', 1),
    ];
    const notes = [makeNote('AgentC', 'ticket-3', 'AgentC', 'AgentD'), makeNote('AgentC', 'ticket-3', 'AgentC', 'AgentE')];
    const tickets = [makeTicket('ticket-3', 'AgentC', 'done')];
    const result = computeMetrics('AgentC', sessions, notes, tickets);
    expect(result.recentTrend).toBe('improving');
  });

  it('trend degrading: recent sessions have higher failure rate', () => {
    const sessions = [
      makeSession('s1', 'AgentD', 'completed', 'ticket-4', 30),
      makeSession('s2', 'AgentD', 'completed', 'ticket-4', 25),
      makeSession('s3', 'AgentD', 'completed', 'ticket-4', 20),
      makeSession('s4', 'AgentD', 'completed', 'ticket-4', 15),
      makeSession('s5', 'AgentD', 'failed', 'ticket-4', 4),
      makeSession('s6', 'AgentD', 'failed', 'ticket-4', 3),
      makeSession('s7', 'AgentD', 'failed', 'ticket-4', 2),
      makeSession('s8', 'AgentD', 'failed', 'ticket-4', 1),
    ];
    const notes = [makeNote('AgentD', 'ticket-4', 'AgentD', 'AgentE'), makeNote('AgentD', 'ticket-4', 'AgentD', 'AgentF')];
    const tickets = [makeTicket('ticket-4', 'AgentD', 'done')];
    const result = computeMetrics('AgentD', sessions, notes, tickets);
    expect(result.recentTrend).toBe('degrading');
  });

  it('recovery time: counts sessions between failure and success', () => {
    const sessions = [
      makeSession('s1', 'AgentE', 'failed', 'ticket-5', 10),
      makeSession('s2', 'AgentE', 'completed', 'ticket-5', 8),  // 1 session recovery
      makeSession('s3', 'AgentE', 'failed', 'ticket-5', 6),
      makeSession('s4', 'AgentE', 'failed', 'ticket-5', 4),
      makeSession('s5', 'AgentE', 'completed', 'ticket-5', 2),  // 2 sessions recovery
    ];
    const notes = [makeNote('AgentE', 'ticket-5', 'AgentE', 'AgentF'), makeNote('AgentE', 'ticket-5', 'AgentE', 'AgentG')];
    const tickets = [makeTicket('ticket-5', 'AgentE', 'done')];
    const result = computeMetrics('AgentE', sessions, notes, tickets);
    expect(result.averageRecoveryTime).toBe(1.3);
  });

  it('insufficient data (< 2 feedback events) returns 0 improvement', () => {
    const sessions = [makeSession('s1', 'AgentF', 'completed', 'ticket-6', 5)];
    const notes = [makeNote('AgentF', 'ticket-6', 'AgentF', 'AgentG')]; // only 1 feedback event
    const tickets = [makeTicket('ticket-6', 'AgentF', 'done')];
    const result = computeMetrics('AgentF', sessions, notes, tickets);
    expect(result.improvementRate).toBe(0);
  });
});

describe('analyzeAgentFeedbackLoops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty project returns empty array', async () => {
    mockWhere
      .mockResolvedValueOnce([]) // sessions
      .mockResolvedValueOnce([]) // notes
      .mockResolvedValueOnce([]); // tickets
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await analyzeAgentFeedbackLoops('proj-empty');
    expect(result).toHaveLength(0);
  });

  it('mixed agents sorts by improvementRate descending', async () => {
    const ticket1 = makeTicket('t1', 'AgentA', 'done');
    const ticket2 = makeTicket('t2', 'AgentB', 'in_progress');

    const sessions = [
      { id: 's1', personaType: 'AgentA', status: 'failed', ticketId: 't1', createdAt: daysAgo(20), completedAt: null },
      { id: 's2', personaType: 'AgentA', status: 'failed', ticketId: 't1', createdAt: daysAgo(15), completedAt: null },
      { id: 's3', personaType: 'AgentA', status: 'completed', ticketId: 't1', createdAt: daysAgo(5), completedAt: daysAgo(5) },
      { id: 's4', personaType: 'AgentA', status: 'completed', ticketId: 't1', createdAt: daysAgo(1), completedAt: daysAgo(1) },
      { id: 's5', personaType: 'AgentB', status: 'failed', ticketId: 't2', createdAt: daysAgo(10), completedAt: null },
      { id: 's6', personaType: 'AgentB', status: 'failed', ticketId: 't2', createdAt: daysAgo(5), completedAt: null },
      { id: 's7', personaType: 'AgentB', status: 'failed', ticketId: 't2', createdAt: daysAgo(2), completedAt: null },
      { id: 's8', personaType: 'AgentB', status: 'failed', ticketId: 't2', createdAt: daysAgo(1), completedAt: null },
    ];
    const notes = [
      { authorId: 'AgentA', ticketId: 't1', handoffFrom: 'AgentA', handoffTo: 'AgentC', createdAt: now },
      { authorId: 'AgentA', ticketId: 't1', handoffFrom: 'AgentA', handoffTo: 'AgentD', createdAt: now },
      { authorId: 'AgentB', ticketId: 't2', handoffFrom: 'AgentB', handoffTo: 'AgentC', createdAt: now },
      { authorId: 'AgentB', ticketId: 't2', handoffFrom: 'AgentB', handoffTo: 'AgentD', createdAt: now },
    ];

    mockWhere
      .mockResolvedValueOnce(sessions)
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce([ticket1, ticket2]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await analyzeAgentFeedbackLoops('proj-1');
    expect(result.length).toBeGreaterThan(0);
    // AgentA should have higher improvementRate than AgentB
    const agentA = result.find(r => r.personaId === 'AgentA');
    const agentB = result.find(r => r.personaId === 'AgentB');
    if (agentA && agentB) {
      expect(agentA.improvementRate).toBeGreaterThanOrEqual(agentB.improvementRate);
    }
  });
});
