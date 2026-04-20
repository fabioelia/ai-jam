import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRecoveryPatterns } from './agent-recovery-pattern-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiInsights":"ok","recommendations":["improve recovery"]}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}
function makeTicket(id: string, assignedPersona: string | null, status: string, createdHoursAgo = 48, updatedHoursAgo = 2) {
  const now = new Date();
  return {
    id,
    assignedPersona,
    status,
    createdAt: new Date(now.getTime() - createdHoursAgo * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - updatedHoursAgo * 60 * 60 * 1000),
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeRecoveryPatterns', () => {
  it('returns empty result when no failure tickets', async () => {
    mockDb([makeTicket('t1', 'alice', 'done'), makeTicket('t2', 'alice', 'in_progress')]);
    const result = await analyzeRecoveryPatterns('proj-1');
    expect(result.totalFailureEvents).toBe(0);
    expect(result.agentProfiles).toHaveLength(0);
    expect(result.recentEvents).toHaveLength(0);
  });

  it('counts failure events as review status tickets', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'review'),
      makeTicket('t2', 'alice', 'review'),
      makeTicket('t3', 'alice', 'done'),
    ]);
    const result = await analyzeRecoveryPatterns('proj-1');
    expect(result.totalFailureEvents).toBe(2);
    const alice = result.agentProfiles.find(a => a.agentPersona === 'alice');
    expect(alice?.totalFailureEvents).toBe(2);
  });

  it('computes recovery rate correctly', async () => {
    // cycleTime < 24h → self recovery (recovered=true)
    mockDb([
      makeTicket('t1', 'alice', 'review', 10, 2), // cycleTime = 8h < 24 → recovered
      makeTicket('t2', 'alice', 'review', 100, 5), // cycleTime = 95h > 24 → unresolved
    ]);
    const result = await analyzeRecoveryPatterns('proj-1');
    const alice = result.agentProfiles.find(a => a.agentPersona === 'alice');
    expect(alice?.recoveredCount).toBe(1);
    expect(alice?.failedToRecover).toBe(1);
    expect(alice?.recoveryRate).toBe(0.5);
  });

  it('computes selfRecoveryRate correctly', async () => {
    mockDb([
      makeTicket('t1', 'bob', 'review', 10, 2), // cycleTime < 24h → self
      makeTicket('t2', 'bob', 'review', 10, 2), // cycleTime < 24h → self
      makeTicket('t3', 'bob', 'review', 100, 5), // cycleTime > 24h → unresolved
    ]);
    const result = await analyzeRecoveryPatterns('proj-1');
    const bob = result.agentProfiles.find(a => a.agentPersona === 'bob');
    expect(bob?.selfRecoveryRate).toBeCloseTo(0.667, 2);
  });

  it('limits recentEvents to 10', async () => {
    const manyTickets = Array.from({ length: 15 }, (_, i) =>
      makeTicket(`t${i}`, 'alice', 'review')
    );
    mockDb(manyTickets);
    const result = await analyzeRecoveryPatterns('proj-1');
    expect(result.recentEvents.length).toBeLessThanOrEqual(10);
  });

  it('computes overallRecoveryRate across agents', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'review', 10, 2), // recovered
      makeTicket('t2', 'bob', 'review', 100, 5),   // not recovered
    ]);
    const result = await analyzeRecoveryPatterns('proj-1');
    expect(result.overallRecoveryRate).toBe(0.5);
    expect(result.totalFailureEvents).toBe(2);
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
    }));
    mockDb([makeTicket('t1', 'alice', 'review')]);
    const result = await analyzeRecoveryPatterns('proj-1');
    expect(result.aiInsights).toBe('Analyze recovery patterns to understand how agents handle failure events and improve resilience.');
  });
});
