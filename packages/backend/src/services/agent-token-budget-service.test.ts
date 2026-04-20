import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentTokenBudget,
  buildTokenBudgetProfiles,
  computeEfficiencyTier,
  computeEfficiencyScore,
  estimateTokens,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-token-budget-service.js';

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
                summary: 'AI token budget summary.',
                recommendations: ['Reduce handoff note length.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
};

type TicketRow = { id: string; assignedPersona: string | null; status: string };
type SessionRow = { personaType: string };

function makeNote(
  ticketId: string,
  authorId: string,
  content: string,
  handoffFrom: string | null = null,
  handoffTo: string | null = null,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content,
    handoffFrom,
    handoffTo,
  };
}

function makeTicket(id: string, assignedPersona: string | null = null, status = 'in_progress'): TicketRow {
  return { id, assignedPersona, status };
}

function makeSession(personaType: string): SessionRow {
  return { personaType };
}

function mockDb(tickets: TicketRow[], notes: NoteRow[], sessions: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      if (callCount === 2) return Promise.resolve(notes);
      return Promise.resolve(sessions);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], [], []);
  const report = await analyzeAgentTokenBudget('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.totalEstimatedTokens).toBe(0);
  expect(report.avgTokensPerTicket).toBe(0);
  expect(report.mostEfficientAgent).toBeNull();
  expect(report.leastEfficientAgent).toBeNull();
});

// Test 2: efficiency tier thresholds
it('assigns efficiency tiers correctly', () => {
  expect(computeEfficiencyTier(100)).toBe('optimal');
  expect(computeEfficiencyTier(75)).toBe('optimal');
  expect(computeEfficiencyTier(74)).toBe('efficient');
  expect(computeEfficiencyTier(50)).toBe('efficient');
  expect(computeEfficiencyTier(49)).toBe('moderate');
  expect(computeEfficiencyTier(25)).toBe('moderate');
  expect(computeEfficiencyTier(24)).toBe('expensive');
  expect(computeEfficiencyTier(0)).toBe('expensive');
});

// Test 3: token formula verification
it('computes estimatedTokens using correct formula', () => {
  // estimatedTokens = sessionCount*500 + handoffs*handoffNoteAvgLen/4 + ticketNoteAvgLen*completed/4
  expect(estimateTokens(2, 1, 400, 200, 3)).toBe(
    Math.round(2 * 500 + (1 * 400) / 4 + (200 * 3) / 4),
  );
  // 1000 + 100 + 150 = 1250
  expect(estimateTokens(2, 1, 400, 200, 3)).toBe(1250);
});

// Test 4: single high-efficiency agent
it('identifies single high-efficiency agent correctly', () => {
  // Low tokensPerTicket → high score
  // 1 session (500), 0 handoffs, 1 done ticket, short notes (10 chars)
  // estimatedTokens = 500 + 0 + 10*1/4 = 502.5 ≈ 503
  // tokensPerTicket = 503 / 1 = 503
  // efficiencyScore = max(0, 100 - 503/100) = max(0, 100 - 5.03) ≈ 95
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'done!'),
  ];
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentA', 'done')];
  const sessions: SessionRow[] = [makeSession('AgentA')];
  const profiles = buildTokenBudgetProfiles(notes, tickets, sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agent).toBeDefined();
  expect(agent.sessionCount).toBe(1);
  expect(agent.ticketsCompleted).toBe(1);
  expect(agent.efficiencyScore).toBeGreaterThan(90);
  expect(agent.efficiencyTier).toBe('optimal');
});

// Test 5: expensive agent with many sessions and long notes
it('marks agent with high tokensPerTicket as expensive', () => {
  // 10 sessions (5000), 5 handoffs, each handoff note 4000 chars → 4000*5/4=5000
  // 0 done tickets → tokensPerTicket = 10000 / 1 = 10000
  // score = max(0, 100 - 100) = 0 → expensive
  const handoffContent = 'x'.repeat(4000);
  const notes: NoteRow[] = Array.from({ length: 5 }, (_, i) =>
    makeNote('t1', 'AgentX', handoffContent, 'AgentX', 'AgentY'),
  );
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentX', 'in_progress')];
  const sessions: SessionRow[] = Array.from({ length: 10 }, () => makeSession('AgentX'));
  const profiles = buildTokenBudgetProfiles(notes, tickets, sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentX')!;
  expect(agent).toBeDefined();
  expect(agent.efficiencyTier).toBe('expensive');
  expect(agent.efficiencyScore).toBe(0);
});

// Test 6: mixed agents — most/least efficient identified
it('identifies mostEfficientAgent and leastEfficientAgent', async () => {
  // AgentA: 1 session, 1 done ticket, short note → high score
  // AgentB: 10 sessions, 0 done tickets → low score (expensive)
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'ok'),
    makeNote('t2', 'AgentB', 'x'.repeat(2000)),
  ];
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentB', 'in_progress'),
  ];
  const sessions: SessionRow[] = [
    makeSession('AgentA'),
    ...Array.from({ length: 10 }, () => makeSession('AgentB')),
  ];
  mockDb(ticketRows, notes, sessions);
  const report = await analyzeAgentTokenBudget('proj-1');
  expect(report.mostEfficientAgent).toBe('AgentA');
  expect(report.leastEfficientAgent).toBe('AgentB');
});

// Test 7: zero completed tickets — tokensPerTicket uses max(completed,1)
it('handles zero completed tickets without division error', () => {
  const notes: NoteRow[] = [makeNote('t1', 'AgentZ', 'working...')];
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentZ', 'in_progress')];
  const sessions: SessionRow[] = [makeSession('AgentZ')];
  const profiles = buildTokenBudgetProfiles(notes, tickets, sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentZ')!;
  expect(agent).toBeDefined();
  expect(agent.ticketsCompleted).toBe(0);
  // Should not throw; tokensPerTicket = estimatedTokens / 1
  expect(agent.tokensPerTicket).toBe(agent.estimatedTokens);
});

// Test 8: AI fallback on error
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI error')),
    },
  }));

  mockDb([], [], []);
  const report = await analyzeAgentTokenBudget('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
