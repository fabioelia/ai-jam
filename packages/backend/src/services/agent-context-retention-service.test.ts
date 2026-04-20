import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeContextRetention,
  computeRetentionScore,
  computeGrade,
  computeAgentScores,
  FALLBACK_RECOMMENDATION,
} from './agent-context-retention-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI context recommendation.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

function makeTicket(assignedPersona: string | null) {
  return { id: `t-${Math.random().toString(36).slice(2)}`, assignedPersona };
}

function makeHandoff(handoffFrom: string | null, handoffTo: string | null, ticketId: string) {
  return { ticketId, handoffFrom, handoffTo };
}

function mockDb(tickets: ReturnType<typeof makeTicket>[], notes: ReturnType<typeof makeHandoff>[]) {
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

beforeEach(() => {
  vi.clearAllMocks();
});

// AC2: score formula
describe('computeRetentionScore', () => {
  it('computes score = 100 - midFlowPickups*10 - escalationRate*50', () => {
    expect(computeRetentionScore(2, 0.4)).toBe(100 - 20 - 20);
  });

  it('clamps score to 0 when formula goes negative', () => {
    expect(computeRetentionScore(20, 1)).toBe(0);
  });

  it('clamps score to 100 max (no penalty)', () => {
    expect(computeRetentionScore(0, 0)).toBe(100);
  });
});

// AC3: grade mapping
describe('computeGrade', () => {
  it('returns A for score >= 90', () => expect(computeGrade(95)).toBe('A'));
  it('returns B for score >= 75', () => expect(computeGrade(80)).toBe('B'));
  it('returns C for score >= 60', () => expect(computeGrade(65)).toBe('C'));
  it('returns D for score >= 40', () => expect(computeGrade(50)).toBe('D'));
  it('returns F for score < 40', () => expect(computeGrade(30)).toBe('F'));
});

// AC4: needsAttention = D or F
describe('computeAgentScores', () => {
  it('sorts agentScores by contextRetentionScore descending', () => {
    const t1 = makeTicket('AgentA');
    const t2 = makeTicket('AgentB');
    // AgentA: 0 pickups, 0 escalations → score=100
    // AgentB: 2 mid-flow pickups (from outsider) → score=80
    const handoffs = [
      makeHandoff('outsider', 'AgentB', t2.id),
      makeHandoff('outsider', 'AgentB', t2.id),
    ];
    const scores = computeAgentScores([t1, t2], handoffs);
    expect(scores[0].agentType).toBe('AgentA');
    expect(scores[1].agentType).toBe('AgentB');
    expect(scores[0].contextRetentionScore).toBeGreaterThanOrEqual(scores[1].contextRetentionScore);
  });
});

// AC1: report shape
describe('analyzeContextRetention', () => {
  it('returns valid ContextRetentionReport shape', async () => {
    const t1 = makeTicket('Alice');
    mockDb([t1], []);
    const report = await analyzeContextRetention('proj-1');
    expect(report).toMatchObject({
      projectId: 'proj-1',
      totalTicketsAnalyzed: expect.any(Number),
      avgRetentionScore: expect.any(Number),
      agentScores: expect.any(Array),
      needsAttention: expect.any(Array),
      aiRecommendation: expect.any(String),
      analyzedAt: expect.any(String),
    });
  });

  // AC4: needsAttention includes D/F grades
  it('includes D/F grade agents in needsAttention', async () => {
    // 6 pickups on Alice → score = 100 - 60 - 0 = 40 → D
    const t1 = makeTicket('Alice');
    const handoffs = Array.from({ length: 6 }, () => makeHandoff('Bob', 'Alice', t1.id));
    mockDb([t1], handoffs);
    const report = await analyzeContextRetention('proj-1');
    const alice = report.agentScores.find((s) => s.agentType === 'Alice');
    expect(alice!.grade === 'D' || alice!.grade === 'F').toBe(true);
    expect(report.needsAttention).toContain('Alice');
  });

  // AC8: fallback when AI fails
  it('uses fallback aiRecommendation when AI call fails', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API unavailable')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    const t1 = makeTicket('Alice');
    mockDb([t1], []);
    const report = await analyzeContextRetention('proj-1');
    expect(report.aiRecommendation).toBe(FALLBACK_RECOMMENDATION);
  });

  // topPerformer = agent with highest score
  it('sets topPerformer to agent with highest score', async () => {
    const t1 = makeTicket('Alice');
    const t2 = makeTicket('Bob');
    // Bob gets 3 mid-flow pickups from outsider → lower score; Alice untouched
    const handoffs = Array.from({ length: 3 }, () => makeHandoff('outsider', 'Bob', t2.id));
    mockDb([t1, t2], handoffs);
    const report = await analyzeContextRetention('proj-1');
    // Alice: 0 pickups, 0 escalations → score=100; Bob: 3 pickups → score=70
    expect(report.topPerformer).toBe('Alice');
  });

  // empty project
  it('returns empty agentScores when no tickets assigned', async () => {
    mockDb([], []);
    const report = await analyzeContextRetention('proj-1');
    expect(report.agentScores).toHaveLength(0);
    expect(report.totalTicketsAnalyzed).toBe(0);
  });
});
