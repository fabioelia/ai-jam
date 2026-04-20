import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentBlockerFrequency,
  buildBlockerProfiles,
  computeSeverityTier,
  classifyBlocker,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type NoteRow,
} from './agent-blocker-frequency-service.js';

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
                summary: 'AI blocker frequency summary.',
                recommendations: ['Reduce dependency blockers.'],
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

type TicketRow = { id: string; assignedPersona: string | null; createdAt: Date; updatedAt: Date };

function makeTicket(id: string, assignedPersona: string | null = null): TicketRow {
  return {
    id,
    assignedPersona,
    createdAt: new Date(NOW.getTime()),
    updatedAt: new Date(NOW.getTime() + 3600_000),
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

// Test 1: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], []);
  const report = await analyzeAgentBlockerFrequency('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.totalBlockerEvents).toBe(0);
  expect(report.systemAvgBlockerRate).toBe(0);
  expect(report.mostBlockedAgent).toBeNull();
  expect(report.leastBlockedAgent).toBeNull();
});

// Test 2: severity tier thresholds
it('assigns severity tiers correctly', () => {
  expect(computeSeverityTier(0)).toBe('minimal');
  expect(computeSeverityTier(9)).toBe('minimal');
  expect(computeSeverityTier(10)).toBe('manageable');
  expect(computeSeverityTier(29)).toBe('manageable');
  expect(computeSeverityTier(30)).toBe('significant');
  expect(computeSeverityTier(59)).toBe('significant');
  expect(computeSeverityTier(60)).toBe('critical');
  expect(computeSeverityTier(100)).toBe('critical');
});

// Test 3: blocker classification
it('classifies blocker notes into correct categories', () => {
  expect(classifyBlocker('waiting for info from stakeholder')).toBe('waitingForInfo');
  expect(classifyBlocker('blocked by FEAT-010 dependency')).toBe('dependencyBlocked');
  expect(classifyBlocker('waiting for review and approval')).toBe('reviewBlocked');
  expect(classifyBlocker('needs clarification on requirements')).toBe('clarificationNeeded');
  expect(classifyBlocker('something else entirely')).toBe('other');
});

// Test 4: blockerBreakdown counts per category
it('counts blocker events per category in breakdown', () => {
  const notes: NoteRow[] = [
    makeNote('t1', 'Owner', 'handoff', 'AgentA', null, 0),
    makeNote('t1', 'AgentA', 'blocked by FEAT-010 dependency', null, null, 1000),
    makeNote('t1', 'AgentA', 'waiting for review', null, null, 2000),
  ];
  const profiles = buildBlockerProfiles(notes, [makeTicket('t1', 'AgentA')]);
  const agent = profiles.find((p) => p.personaId === 'AgentA');
  expect(agent).toBeDefined();
  expect(agent!.blockerBreakdown.dependencyBlocked).toBe(1);
  expect(agent!.blockerBreakdown.reviewBlocked).toBe(1);
  expect(agent!.totalBlockerEvents).toBe(2);
});

// Test 5: blockerFrequencyScore = blockers/assignments * 100, capped at 100
it('computes blockerFrequencyScore correctly', () => {
  // 1 assignment, 1 blocker = 100 score (capped)
  const notes1: NoteRow[] = [
    makeNote('t1', 'Owner', 'handoff', 'AgentA', null, 0),
    makeNote('t1', 'AgentA', 'blocked: waiting for info from PM', null, null, 1000),
  ];
  const profiles1 = buildBlockerProfiles(notes1, [makeTicket('t1', 'AgentA')]);
  const a1 = profiles1.find((p) => p.personaId === 'AgentA')!;
  expect(a1.blockerFrequencyScore).toBe(100);

  // 2 assignments, 1 blocker = 50 score
  const notes2: NoteRow[] = [
    makeNote('t2', 'Owner', 'handoff', 'AgentB', null, 0),
    makeNote('t2', 'AgentB', 'blocked by dependency on FEAT-005', null, null, 1000),
    makeNote('t3', 'Owner', 'handoff', 'AgentB', null, 0),
    makeNote('t3', 'AgentB', 'working on it', null, null, 1000),
  ];
  const profiles2 = buildBlockerProfiles(notes2, [makeTicket('t2', 'AgentB'), makeTicket('t3', 'AgentB')]);
  const a2 = profiles2.find((p) => p.personaId === 'AgentB')!;
  expect(a2.blockerFrequencyScore).toBe(50);
});

// Test 6: mostBlockedAgent and leastBlockedAgent
it('identifies mostBlockedAgent and leastBlockedAgent', async () => {
  const notes: NoteRow[] = [
    // AgentA: 2 assignments, 2 blockers = score 100
    makeNote('t1', 'Owner', 'handoff', 'AgentA', null, 0),
    makeNote('t1', 'AgentA', 'blocked: waiting for info', null, null, 1000),
    makeNote('t2', 'Owner', 'handoff', 'AgentA', null, 0),
    makeNote('t2', 'AgentA', 'blocked: depends on another task', null, null, 1000),
    // AgentB: 2 assignments, 0 blockers = score 0
    makeNote('t3', 'Owner', 'handoff', 'AgentB', null, 0),
    makeNote('t3', 'AgentB', 'done quickly', null, null, 1000),
    makeNote('t4', 'Owner', 'handoff', 'AgentB', null, 0),
    makeNote('t4', 'AgentB', 'completed', null, null, 2000),
  ];
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA'), makeTicket('t2', 'AgentA'),
    makeTicket('t3', 'AgentB'), makeTicket('t4', 'AgentB'),
  ];
  mockDb(tickets, notes);
  const report = await analyzeAgentBlockerFrequency('proj-1');
  expect(report.mostBlockedAgent).toBe('AgentA');
  expect(report.leastBlockedAgent).toBe('AgentB');
});

// Test 7: totalBlockerEvents sums across all agents
it('sums totalBlockerEvents across all agents', async () => {
  const notes: NoteRow[] = [
    makeNote('t1', 'Owner', 'handoff', 'AgentA', null, 0),
    makeNote('t1', 'AgentA', 'blocked: waiting for info', null, null, 1000),
    makeNote('t2', 'Owner', 'handoff', 'AgentB', null, 0),
    makeNote('t2', 'AgentB', 'blocked: dependency issue', null, null, 1000),
  ];
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentA'), makeTicket('t2', 'AgentB')];
  mockDb(tickets, notes);
  const report = await analyzeAgentBlockerFrequency('proj-1');
  expect(report.totalBlockerEvents).toBe(2);
});

// Test 8: AI fallback on error
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI error')),
    },
  }));

  mockDb([], []);
  const report = await analyzeAgentBlockerFrequency('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
