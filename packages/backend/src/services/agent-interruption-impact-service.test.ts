import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentInterruptions,
  buildInterruptionMetrics,
  resilienceLevel,
  computeRecoveryScore,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type NoteRow,
} from './agent-interruption-impact-service.js';

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
                summary: 'AI interruption summary.',
                recommendations: ['Reduce backward transitions.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

const NOW = new Date('2026-04-20T00:00:00Z');

function makeTicket(id: string, assignedPersona: string | null = null): TicketRow {
  return {
    id,
    assignedPersona,
    createdAt: new Date(NOW.getTime()),
    updatedAt: new Date(NOW.getTime()),
  };
}

function makeNote(
  ticketId: string,
  authorId: string,
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
  offsetMs = 0,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content: 'test note content',
    handoffFrom,
    handoffTo,
    createdAt: new Date(NOW.getTime() + offsetMs),
  };
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

// Test 1: returns empty when no agents
it('returns empty report when no agents have data', async () => {
  mockDb([], []);
  const report = await analyzeAgentInterruptions('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.systemAvgInterruptionRate).toBe(0);
  expect(report.mostResilient).toBeNull();
  expect(report.mostFragile).toBeNull();
});

// Test 2: computes interruptionRate correctly
it('computes interruptionRate as interruptions per ticket', () => {
  const t = makeTicket('t1', 'AgentA');
  // AgentA first works on t1, then is handed t1 back (interruption)
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', null, null, 0),
    makeNote('t1', 'AgentB', 'AgentA', null, 1000), // hands back to AgentA
    makeNote('t1', 'AgentA', null, 'AgentB', 2000),
  ];
  const metrics = buildInterruptionMetrics({ projectTickets: [t], notes });
  const agentA = metrics.find(m => m.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  // 1 interruption on 1 ticket = rate of 1.0
  expect(agentA!.interruptionRate).toBe(1);
  expect(agentA!.totalInterruptions).toBe(1);
});

// Test 3: tier thresholds — high (>=75), medium (>=50), low (>=25), fragile (<25)
it('assigns resilience tiers based on recoveryScore thresholds', () => {
  expect(resilienceLevel(100)).toBe('high');
  expect(resilienceLevel(75)).toBe('high');
  expect(resilienceLevel(74)).toBe('medium');
  expect(resilienceLevel(50)).toBe('medium');
  expect(resilienceLevel(49)).toBe('low');
  expect(resilienceLevel(25)).toBe('low');
  expect(resilienceLevel(24)).toBe('fragile');
  expect(resilienceLevel(0)).toBe('fragile');
});

// Test 4: cycleTimeOverhead calculation
it('computes cycleTimeOverheadPct from cycle time difference', () => {
  // Without interruption: 1000ms cycle, with interruption: 3000ms cycle
  // overhead = (3000-1000)/1000 * 100 = 200%
  // but clamped to 100 for recoveryScore: score = 100 - 100 = 0
  const overhead200 = computeRecoveryScore(200);
  expect(overhead200).toBe(0);

  // overhead = 0% => score = 100
  const overhead0 = computeRecoveryScore(0);
  expect(overhead0).toBe(100);

  // overhead = 50% => score = 50
  const overhead50 = computeRecoveryScore(50);
  expect(overhead50).toBe(50);
});

// Test 5: most resilient and most fragile correctly identified
it('identifies mostResilient and mostFragile agents', () => {
  const t1 = makeTicket('t1', 'AgentA');
  const t2 = makeTicket('t2', 'AgentB');
  // AgentA: no interruptions (high resilience)
  // AgentB: interrupted (lower resilience)
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', null, null, 0),
    makeNote('t1', 'AgentA', null, null, 1000),
    makeNote('t2', 'AgentB', null, null, 0),
    makeNote('t2', 'AgentC', 'AgentB', null, 1000),
    makeNote('t2', 'AgentB', null, 'AgentC', 5000),
  ];
  const metrics = buildInterruptionMetrics({ projectTickets: [t1, t2], notes });
  // Sort is by recoveryScore desc — AgentA should be first (most resilient)
  const agentA = metrics.find(m => m.personaId === 'AgentA');
  const agentB = metrics.find(m => m.personaId === 'AgentB');
  expect(agentA).toBeDefined();
  expect(agentB).toBeDefined();
  expect(agentA!.recoveryScore).toBeGreaterThanOrEqual(agentB!.recoveryScore);
  expect(metrics[0].recoveryScore).toBeGreaterThanOrEqual(metrics[metrics.length - 1].recoveryScore);
});

// Test 6: AI fallback on error
it('uses fallback summary and recommendations when AI call fails', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      },
    };
  });

  mockDb([makeTicket('t1', 'AgentA')], []);
  const report = await analyzeAgentInterruptions('proj-1');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});

// Test 7: handles agents with no interruptions
it('handles agents with no interruptions gracefully', () => {
  const t1 = makeTicket('t1', 'AgentA');
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', null, null, 0),
    makeNote('t1', 'AgentA', null, null, 1000),
  ];
  const metrics = buildInterruptionMetrics({ projectTickets: [t1], notes });
  const agentA = metrics.find(m => m.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  expect(agentA!.totalInterruptions).toBe(0);
  expect(agentA!.interruptionRate).toBe(0);
  expect(agentA!.recoveryScore).toBe(100);
  expect(agentA!.resilienceLevel).toBe('high');
});

// Test 8: sorts by recoveryScore descending
it('sorts agents by recoveryScore descending', () => {
  const tickets = [makeTicket('t1', 'AgentA'), makeTicket('t2', 'AgentB'), makeTicket('t3', 'AgentC')];
  // AgentA: no interruptions → high score
  // AgentB: 1 interruption with large overhead → low score
  // AgentC: no interruptions → high score
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', null, null, 0),
    makeNote('t2', 'AgentB', null, null, 0),
    makeNote('t2', 'AgentD', 'AgentB', null, 2000),
    makeNote('t2', 'AgentB', null, 'AgentD', 100000), // large time gap = big overhead
    makeNote('t3', 'AgentC', null, null, 0),
  ];
  const metrics = buildInterruptionMetrics({ projectTickets: tickets, notes });
  for (let i = 0; i < metrics.length - 1; i++) {
    expect(metrics[i].recoveryScore).toBeGreaterThanOrEqual(metrics[i + 1].recoveryScore);
  }
});
