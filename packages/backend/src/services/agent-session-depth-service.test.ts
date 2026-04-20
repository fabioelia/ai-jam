import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWhere, mockInnerJoin, mockFrom, mockSelect, mockCreate } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
  const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin, where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockCreate = vi.fn();
  return { mockWhere, mockInnerJoin, mockFrom, mockSelect, mockCreate };
});

vi.mock('../db/connection.js', () => ({
  db: { select: mockSelect },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

// Minimal drizzle-orm mocks (service imports these for query building)
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

import { analyzeSessionDepth, buildProfilesFromSessions, buildFallbackProfiles } from './agent-session-depth-service.js';

type S = { personaType: string; ticketId: string | null; startedAt: Date | null; completedAt: Date | null };
type N = { authorId: string; ticketId: string; handoffFrom: string | null; handoffTo: string | null };

function makeSession(personaType: string, ticketId: string, startedAt: Date | null = null, completedAt: Date | null = null): S {
  return { personaType, ticketId, startedAt, completedAt };
}

function makeNote(authorId: string, ticketId: string, handoffFrom?: string, handoffTo?: string): N {
  return { authorId, ticketId, handoffFrom: handoffFrom ?? null, handoffTo: handoffTo ?? null };
}

const DEFAULT_AI_RESPONSE = {
  content: [{ type: 'text' as const, text: '{"summary":"AI summary","recommendations":["rec1","rec2"]}' }],
};

describe('analyzeSessionDepth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(DEFAULT_AI_RESPONSE);
  });

  it('empty project returns empty report', async () => {
    mockWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await analyzeSessionDepth('project-1');

    expect(result.agents).toHaveLength(0);
    expect(result.avgDepthScore).toBe(0);
    expect(result.deepestAgent).toBeNull();
    expect(result.shallowestAgent).toBeNull();
    expect(result.passThroughCount).toBe(0);
  });

  it('single deep agent with many tickets, handoffs, and long sessions', async () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T04:00:00Z'); // 4h each
    const sessions: S[] = Array.from({ length: 5 }, (_, i) =>
      makeSession('deep-agent', `ticket-${i}`, start, end),
    );
    const notes: N[] = [
      ...Array.from({ length: 10 }, (_, i) => makeNote('deep-agent', `ticket-${i % 5}`, 'deep-agent', 'other')),
      ...Array.from({ length: 5 }, (_, i) => makeNote('deep-agent', `ticket-${i}`, 'other', 'deep-agent')),
    ];
    mockWhere.mockResolvedValueOnce(sessions).mockResolvedValueOnce(notes);

    const result = await analyzeSessionDepth('project-1');

    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0];
    expect(agent.personaId).toBe('deep-agent');
    expect(agent.depthScore).toBe(100);
    expect(agent.depthCategory).toBe('deep');
    expect(agent.totalSessions).toBe(5);
    expect(agent.avgSessionDurationHours).toBeCloseTo(4, 5);
    expect(result.deepestAgent).toBe('deep-agent');
  });

  it('pass-through agent has score < 20 relative to deep agent', async () => {
    // deep-agent: 5 sessions, 5 unique tickets (avg=1.0), 10 sent, 5 received, 2h each
    // pass-agent: 10 sessions all on same ticket (avgTickets=1/10=0.1), 0 handoffs, no duration
    // pass-agent normalized: nT=0.1/1.0=0.1, nS=0, nD=0, nR=0 → score=4 → pass-through
    const start = new Date('2024-01-01T00:00:00Z');
    const end2h = new Date('2024-01-01T02:00:00Z');
    const deepSessions: S[] = Array.from({ length: 5 }, (_, i) =>
      makeSession('deep-agent', `td${i}`, start, end2h),
    );
    const passSessions: S[] = Array.from({ length: 10 }, () =>
      makeSession('pass-agent', 'tp1'),
    );
    const deepNotes: N[] = [
      ...Array.from({ length: 10 }, (_, i) => makeNote('x', `td${i % 5}`, 'deep-agent', 'other')),
      ...Array.from({ length: 5 }, (_, i) => makeNote('x', `td${i}`, 'other', 'deep-agent')),
    ];

    mockWhere
      .mockResolvedValueOnce([...deepSessions, ...passSessions])
      .mockResolvedValueOnce(deepNotes);

    const result = await analyzeSessionDepth('project-1');

    const passAgent = result.agents.find(a => a.personaId === 'pass-agent');
    expect(passAgent).toBeDefined();
    expect(passAgent!.avgTicketsPerSession).toBeCloseTo(0.1, 5);
    expect(passAgent!.depthScore).toBeLessThan(20);
    expect(passAgent!.depthCategory).toBe('pass-through');
    expect(result.passThroughCount).toBeGreaterThanOrEqual(1);
  });

  it('mixed categories produce correct classification for all agents', async () => {
    // Use 4 agents with normalized values 1.0, 0.7, 0.45, 0.2 across all metrics
    // MAX: 10 sessions, 10 unique tickets (avg=1.0), 10 sent, 10 received, 1h each
    // B70: 10 sessions, 7 unique tickets (avg=0.7), 7 sent, 7 received, 42min (0.7h) each
    // B45: 20 sessions, 9 unique tickets (avg=0.45), 9 sent, 9 received, 27min (0.45h) each
    // B20: 10 sessions, 2 unique tickets (avg=0.2), 2 sent, 2 received, 12min (0.2h) each
    const h = (hours: number) => new Date(Date.now() + hours * 3_600_000);
    const sess = (p: string, t: string, dur: number) =>
      makeSession(p, t, new Date('2024-01-01T00:00:00Z'), new Date(new Date('2024-01-01T00:00:00Z').getTime() + dur * 3_600_000));

    const maxSessions: S[] = Array.from({ length: 10 }, (_, i) => sess('max', `max-t${i}`, 1));
    const b70Sessions: S[] = [
      ...Array.from({ length: 7 }, (_, i) => sess('b70', `b70-t${i}`, 0.7)),
      ...Array.from({ length: 3 }, () => sess('b70', 'b70-t0', 0.7)),
    ];
    const b45Sessions: S[] = [
      ...Array.from({ length: 9 }, (_, i) => sess('b45', `b45-t${i}`, 0.45)),
      ...Array.from({ length: 11 }, () => sess('b45', 'b45-t0', 0.45)),
    ];
    const b20Sessions: S[] = [
      sess('b20', 'b20-t0', 0.2),
      sess('b20', 'b20-t1', 0.2),
      ...Array.from({ length: 8 }, () => sess('b20', 'b20-t0', 0.2)),
    ];

    const notes: N[] = [
      ...Array.from({ length: 10 }, (_, i) => makeNote('x', `max-t${i}`, 'max', 'other')),
      ...Array.from({ length: 10 }, (_, i) => makeNote('x', `max-t${i}`, 'other', 'max')),
      ...Array.from({ length: 7 }, (_, i) => makeNote('x', `b70-t${i % 7}`, 'b70', 'other')),
      ...Array.from({ length: 7 }, (_, i) => makeNote('x', `b70-t${i % 7}`, 'other', 'b70')),
      ...Array.from({ length: 9 }, (_, i) => makeNote('x', `b45-t${i % 9}`, 'b45', 'other')),
      ...Array.from({ length: 9 }, (_, i) => makeNote('x', `b45-t${i % 9}`, 'other', 'b45')),
      ...Array.from({ length: 2 }, (_, i) => makeNote('x', `b20-t${i}`, 'b20', 'other')),
      ...Array.from({ length: 2 }, (_, i) => makeNote('x', `b20-t${i}`, 'other', 'b20')),
    ];

    mockWhere
      .mockResolvedValueOnce([...maxSessions, ...b70Sessions, ...b45Sessions, ...b20Sessions])
      .mockResolvedValueOnce(notes);

    const result = await analyzeSessionDepth('project-1');
    const byId = Object.fromEntries(result.agents.map(a => [a.personaId, a]));

    expect(byId['max'].depthCategory).toBe('deep');
    expect(byId['b70'].depthCategory).toBe('deep');
    expect(byId['b45'].depthCategory).toBe('moderate');
    expect(byId['b20'].depthCategory).toBe('shallow');
    expect(result.agents[0].personaId).toBe('max');
  });

  it('depth score weights: 40% tickets, 30% sent, 20% duration, 10% received', async () => {
    // Single agent with only ticket metric (no handoffs, no duration)
    // Normalized ticket = 1.0, others = 0 → score = 40
    const sessions: S[] = [makeSession('agent', 'ticket-1')];
    mockWhere.mockResolvedValueOnce(sessions).mockResolvedValueOnce([]);

    const result = await analyzeSessionDepth('project-1');
    expect(result.agents[0].depthScore).toBe(40);

    vi.clearAllMocks();
    mockCreate.mockResolvedValue(DEFAULT_AI_RESPONSE);

    // Two agents: MAX has all metrics; SENT-only has only sent handoffs
    // MAX: 1 session, 1 ticket, 2 sent handoffs, 1h, 1 received
    // SENT: 1 session, 1 ticket (same ratio → nT=1), 1 sent, 0h, 0 received
    // maxSent=2, SENT nS = 1/2 = 0.5, maxDur=1h, SENT nD=0, maxRec=1, SENT nR=0
    // SENT score = (1*0.4 + 0.5*0.3 + 0*0.2 + 0*0.1)*100 = 55
    const start = new Date('2024-01-01T00:00:00Z');
    const end1h = new Date('2024-01-01T01:00:00Z');
    const sessions2: S[] = [
      makeSession('max', 'mx-t1', start, end1h),
      makeSession('sent-only', 'so-t1'),
    ];
    const notes2: N[] = [
      makeNote('x', 'mx-t1', 'max', 'other'),
      makeNote('x', 'mx-t1', 'max', 'other'),
      makeNote('x', 'mx-t1', 'other', 'max'),
      makeNote('x', 'so-t1', 'sent-only', 'other'),
    ];
    mockWhere.mockResolvedValueOnce(sessions2).mockResolvedValueOnce(notes2);

    const result2 = await analyzeSessionDepth('project-2');
    const sentAgent = result2.agents.find(a => a.personaId === 'sent-only')!;
    // nT=1.0, nS=0.5, nD=0, nR=0 → 0.4 + 0.15 = 0.55 → 55
    expect(sentAgent.depthScore).toBe(55);
  });

  it('duration calculated correctly from startedAt and completedAt', async () => {
    const sessions: S[] = [
      makeSession('agent', 't1', new Date('2024-01-01T00:00:00Z'), new Date('2024-01-01T02:00:00Z')), // 2h
      makeSession('agent', 't2', new Date('2024-01-01T00:00:00Z'), new Date('2024-01-01T04:00:00Z')), // 4h
      makeSession('agent', 't3'), // no duration data
    ];
    mockWhere.mockResolvedValueOnce(sessions).mockResolvedValueOnce([]);

    const result = await analyzeSessionDepth('project-1');
    const agent = result.agents[0];
    // avg duration = (2 + 4) / 2 = 3h (only sessions with both timestamps count)
    expect(agent.avgSessionDurationHours).toBeCloseTo(3, 5);
    expect(agent.totalSessions).toBe(3);
  });

  it('category boundary values: score 70 → deep, 45 → moderate, 20 → shallow', async () => {
    const sess = (p: string, t: string, dur: number) =>
      makeSession(p, t, new Date('2024-01-01T00:00:00Z'), new Date(new Date('2024-01-01T00:00:00Z').getTime() + dur * 3_600_000));

    // MAX: 10 sessions, 10 unique tickets, 10 sent, 10 received, 1h each
    // B70: 10 sessions, 7 unique tickets, 7 sent, 7 received, 0.7h each
    // B45: 20 sessions, 9 unique tickets, 9 sent, 9 received, 0.45h each
    // B20: 10 sessions, 2 unique tickets, 2 sent, 2 received, 0.2h each
    const maxS = Array.from({ length: 10 }, (_, i) => sess('max', `max-t${i}`, 1));
    const b70S = [
      ...Array.from({ length: 7 }, (_, i) => sess('b70', `b70-t${i}`, 0.7)),
      ...Array.from({ length: 3 }, () => sess('b70', 'b70-t0', 0.7)),
    ];
    const b45S = [
      ...Array.from({ length: 9 }, (_, i) => sess('b45', `b45-t${i}`, 0.45)),
      ...Array.from({ length: 11 }, () => sess('b45', 'b45-t0', 0.45)),
    ];
    const b20S = [
      sess('b20', 'b20-t0', 0.2),
      sess('b20', 'b20-t1', 0.2),
      ...Array.from({ length: 8 }, () => sess('b20', 'b20-t0', 0.2)),
    ];

    const notes: N[] = [
      ...Array.from({ length: 10 }, (_, i) => makeNote('x', `max-t${i}`, 'max', 'other')),
      ...Array.from({ length: 10 }, (_, i) => makeNote('x', `max-t${i}`, 'other', 'max')),
      ...Array.from({ length: 7 }, (_, i) => makeNote('x', `b70-t${i % 7}`, 'b70', 'other')),
      ...Array.from({ length: 7 }, (_, i) => makeNote('x', `b70-t${i % 7}`, 'other', 'b70')),
      ...Array.from({ length: 9 }, (_, i) => makeNote('x', `b45-t${i % 9}`, 'b45', 'other')),
      ...Array.from({ length: 9 }, (_, i) => makeNote('x', `b45-t${i % 9}`, 'other', 'b45')),
      ...Array.from({ length: 2 }, (_, i) => makeNote('x', `b20-t${i}`, 'b20', 'other')),
      ...Array.from({ length: 2 }, (_, i) => makeNote('x', `b20-t${i}`, 'other', 'b20')),
    ];

    mockWhere.mockResolvedValueOnce([...maxS, ...b70S, ...b45S, ...b20S]).mockResolvedValueOnce(notes);

    const result = await analyzeSessionDepth('project-1');
    const byId = Object.fromEntries(result.agents.map(a => [a.personaId, a]));

    expect(byId['b70'].depthScore).toBe(70);
    expect(byId['b70'].depthCategory).toBe('deep');

    expect(byId['b45'].depthScore).toBe(45);
    expect(byId['b45'].depthCategory).toBe('moderate');

    expect(byId['b20'].depthScore).toBe(20);
    expect(byId['b20'].depthCategory).toBe('shallow');
  });

  it('uses fallback summary when AI service is unavailable', async () => {
    const sessions: S[] = [
      makeSession('agent', 't1', new Date('2024-01-01T00:00:00Z'), new Date('2024-01-01T01:00:00Z')),
    ];
    mockWhere.mockResolvedValueOnce(sessions).mockResolvedValueOnce([]);
    mockCreate.mockRejectedValueOnce(new Error('AI service unavailable'));

    const result = await analyzeSessionDepth('project-1');

    expect(result.agents).toHaveLength(1);
    // Should still return a report with fallback summary (not throw)
    expect(result.aiSummary).toContain('100');
    expect(Array.isArray(result.aiRecommendations)).toBe(true);
    expect(result.aiRecommendations.length).toBeGreaterThan(0);
  });
});
