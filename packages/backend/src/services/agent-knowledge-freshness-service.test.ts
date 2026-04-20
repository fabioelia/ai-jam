import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeKnowledgeFreshness,
  buildFreshnessProfiles,
  computeFreshnessScore,
  computeFreshnessCategory,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-knowledge-freshness-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '{"aiSummary":"test","aiRecommendations":["rec1"]}',
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

const NOW = new Date('2026-04-20T12:00:00Z');

function makeHandoff(
  id: string,
  ticketId: string,
  handoffTo: string,
  offsetHours = 0,
) {
  return {
    id,
    ticketId,
    handoffTo,
    createdAt: new Date(NOW.getTime() - offsetHours * 60 * 60 * 1000),
  };
}

function makeSession(
  id: string,
  personaType: string,
  ticketId: string,
  startOffsetHours = 0,
) {
  const startedAt = new Date(NOW.getTime() - startOffsetHours * 60 * 60 * 1000);
  return {
    id,
    personaType,
    ticketId,
    startedAt,
    createdAt: startedAt,
  };
}

function makeTicket(id: string, updatedOffsetHours = 0) {
  return {
    id,
    updatedAt: new Date(NOW.getTime() - updatedOffsetHours * 60 * 60 * 1000),
  };
}

function mockDb(tickets: object[], notes: object[], sessions: object[]) {
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

// Test 1: Empty project returns empty agents and avgFreshnessScore=0
it('empty project returns empty agents and avgFreshnessScore=0', async () => {
  mockDb([], [], []);
  const report = await analyzeKnowledgeFreshness('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.avgFreshnessScore).toBe(0);
  expect(report.systemStaleHandoffRate).toBe(0);
});

// Test 2: freshnessCategory excellent (score >= 80)
it('freshnessCategory is excellent when score >= 80', () => {
  expect(computeFreshnessCategory(80)).toBe('excellent');
  expect(computeFreshnessCategory(100)).toBe('excellent');
  expect(computeFreshnessCategory(85)).toBe('excellent');
});

// Test 3: freshnessCategory good (score >= 60)
it('freshnessCategory is good when score >= 60 and < 80', () => {
  expect(computeFreshnessCategory(60)).toBe('good');
  expect(computeFreshnessCategory(75)).toBe('good');
  expect(computeFreshnessCategory(79)).toBe('good');
});

// Test 4: freshnessCategory fair (score >= 40)
it('freshnessCategory is fair when score >= 40 and < 60', () => {
  expect(computeFreshnessCategory(40)).toBe('fair');
  expect(computeFreshnessCategory(55)).toBe('fair');
  expect(computeFreshnessCategory(59)).toBe('fair');
});

// Test 5: freshnessCategory stale (score < 40)
it('freshnessCategory is stale when score < 40', () => {
  expect(computeFreshnessCategory(0)).toBe('stale');
  expect(computeFreshnessCategory(20)).toBe('stale');
  expect(computeFreshnessCategory(39)).toBe('stale');
});

// Test 6: freshestAgent and staleestAgent are correct
it('freshestAgent and staleestAgent are identified correctly', () => {
  // Agent A: all fresh handoffs
  // Agent B: all stale handoffs
  const ticket1 = makeTicket('t1', 50);
  const ticket2 = makeTicket('t2', 50);

  // agentA: handoff created 5h ago, agentA session started 0.5h ago (4.5h lag -> not fresh <1h, not stale >24h)
  // agentA: fresh handoff (lag < 1h)
  const handoffA = makeHandoff('h1', 't1', 'agentA', 6); // handoff 6h ago
  const sessionA = makeSession('s1', 'agentA', 't1', 5.7); // session 5.7h ago -> lag = 0.3h < 1h -> fresh

  // agentB: stale handoff (lag > 24h)
  const handoffB = makeHandoff('h2', 't2', 'agentB', 30); // handoff 30h ago
  const sessionB = makeSession('s2', 'agentB', 't2', 3); // session 3h ago -> lag = 27h > 24h -> stale

  const profiles = buildFreshnessProfiles(
    [handoffA, handoffB],
    [sessionA, sessionB],
    [ticket1, ticket2],
  );

  // agentA should have freshHandoffCount=1, agentB staleHandoffCount=1
  const agentA = profiles.find((p) => p.personaId === 'agentA')!;
  const agentB = profiles.find((p) => p.personaId === 'agentB')!;
  expect(agentA).toBeDefined();
  expect(agentB).toBeDefined();
  expect(agentA.freshHandoffCount).toBe(1);
  expect(agentA.staleHandoffCount).toBe(0);
  expect(agentB.staleHandoffCount).toBe(1);
  expect(agentB.freshHandoffCount).toBe(0);
  // agentA score should be higher
  expect(agentA.freshnessScore).toBeGreaterThan(agentB.freshnessScore);
});

// Test 7: systemStaleHandoffRate = staleCount / total
it('systemStaleHandoffRate equals total stale / total handoffs', () => {
  // 2 stale, 2 fresh -> rate = 0.5
  const score1 = computeFreshnessScore(2, 2, 0);
  // Manually verify the formula
  // freshHandoffRate = 2/4 = 0.5, staleHandoffRate = 2/4 = 0.5
  // lagPenalty = max(0, 1-0/48) = 1
  // score = 0.5*50 + (1-0.5)*30 + 1*20 = 25 + 15 + 20 = 60
  expect(score1).toBe(60);

  // Verify profiles generate correct stale rate
  const ticket1 = makeTicket('t1', 50);
  const ticket2 = makeTicket('t2', 50);
  const ticket3 = makeTicket('t3', 50);

  // agentX: 1 stale handoff
  const handoffX1 = makeHandoff('hx1', 't1', 'agentX', 40); // 40h ago
  const sessionX1 = makeSession('sx1', 'agentX', 't1', 10); // 10h ago -> lag = 30h > 24h -> stale

  // agentX: 1 fresh handoff
  const handoffX2 = makeHandoff('hx2', 't2', 'agentX', 2); // 2h ago
  const sessionX2 = makeSession('sx2', 'agentX', 't2', 1.7); // 1.7h ago -> lag = 0.3h < 1h -> fresh

  // agentY: 1 stale handoff
  const handoffY = makeHandoff('hy1', 't3', 'agentY', 50); // 50h ago
  const sessionY = makeSession('sy1', 'agentY', 't3', 20); // 20h ago -> lag = 30h > 24h -> stale

  const profiles = buildFreshnessProfiles(
    [handoffX1, handoffX2, handoffY],
    [sessionX1, sessionX2, sessionY],
    [ticket1, ticket2, ticket3],
  );

  const totalStale = profiles.reduce((s, p) => s + p.staleHandoffCount, 0);
  const totalFresh = profiles.reduce((s, p) => s + p.freshHandoffCount, 0);
  const total = totalStale + totalFresh;
  const rate = total > 0 ? totalStale / total : 0;

  expect(totalStale).toBe(2);
  expect(totalFresh).toBe(1);
  expect(rate).toBeCloseTo(2 / 3, 4);
});

// Test 8: AI fallback on error returns deterministic strings
it('returns fallback strings when AI call fails', async () => {
  // Override mock to throw
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  (Anthropic as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    };
  });

  // Mock DB to return one agent with sessions and handoffs
  const ticket = makeTicket('t1', 10);
  const handoff = makeHandoff('h1', 't1', 'agentZ', 5);
  const session = makeSession('s1', 'agentZ', 't1', 4.5); // lag 0.5h -> fresh

  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([ticket]);
      if (callCount === 2) return Promise.resolve([{ ...handoff, handoffTo: 'agentZ' }]);
      return Promise.resolve([session]);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

  const report = await analyzeKnowledgeFreshness('proj-fallback');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
