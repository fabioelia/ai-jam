import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { db } from '../db/connection.js';
import { analyzeAgentDependencies } from './agent-dependency-mapper-service.js';

function makeSelect(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function makeTicket(
  id: string,
  persona: string | null,
  blockedBy: string | null,
  status = 'in_progress',
) {
  return { id, assignedPersona: persona, blockedBy, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '[]' }] });
});

describe('analyzeAgentDependencies', () => {
  it('returns empty agentDependencyEdges when no blocked tickets', async () => {
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('t1', 'Alice', null),
      makeTicket('t2', 'Bob', null),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    expect(result.agentDependencyEdges).toEqual([]);
    expect(result.totalEdges).toBe(0);
  });

  it('excludes same-agent blocks (blockingAgent === waitingAgent)', async () => {
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('t1', 'Alice', null),
      makeTicket('t2', 'Alice', 't1'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    expect(result.agentDependencyEdges).toHaveLength(0);
    expect(result.totalEdges).toBe(0);
  });

  it('marks critical severity when blockingScore >= 75', async () => {
    // blockedTickets=2, totalBlockingTickets=1 → (2/1)*60+2*8=136 → capped 100 → critical
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('ta', 'AgentA', null),
      makeTicket('tb1', 'AgentB', 'ta'),
      makeTicket('tb2', 'AgentB', 'ta'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    expect(result.agentDependencyEdges).toHaveLength(1);
    expect(result.agentDependencyEdges[0].severity).toBe('critical');
    expect(result.agentDependencyEdges[0].blockingScore).toBeGreaterThanOrEqual(75);
  });

  it('marks high severity when blockingScore >= 50', async () => {
    // blockedTickets=1, totalBlockingTickets=1 → (1/1)*60+1*8=68 → high
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('tc', 'AgentC', null),
      makeTicket('td', 'AgentD', 'tc'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    expect(result.agentDependencyEdges[0].severity).toBe('high');
    expect(result.agentDependencyEdges[0].blockingScore).toBeGreaterThanOrEqual(50);
    expect(result.agentDependencyEdges[0].blockingScore).toBeLessThan(75);
  });

  it('marks moderate severity when blockingScore >= 25', async () => {
    // AgentE has 2 blocking tickets (te1, te2), each referenced once
    // Edge E→F: blockedTickets=1, totalBlockingTickets=2 → (1/2)*60+1*8=38 → moderate
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('te1', 'AgentE', null),
      makeTicket('te2', 'AgentE', null),
      makeTicket('tf', 'AgentF', 'te1'),
      makeTicket('tg', 'AgentG', 'te2'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    const efEdge = result.agentDependencyEdges.find(
      (e) => e.blockingAgent === 'AgentE' && e.waitingAgent === 'AgentF',
    );
    expect(efEdge).toBeDefined();
    expect(efEdge!.severity).toBe('moderate');
    expect(efEdge!.blockingScore).toBeGreaterThanOrEqual(25);
    expect(efEdge!.blockingScore).toBeLessThan(50);
  });

  it('marks low severity when blockingScore > 0 and < 25', async () => {
    // AgentH has 4 blocking tickets, Edge H→I: blockedTickets=1, totalBlockingTickets=4
    // score = (1/4)*60+1*8 = 15+8 = 23 → low
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('th1', 'AgentH', null),
      makeTicket('th2', 'AgentH', null),
      makeTicket('th3', 'AgentH', null),
      makeTicket('th4', 'AgentH', null),
      makeTicket('ti', 'AgentI', 'th1'),
      makeTicket('tj', 'AgentJ', 'th2'),
      makeTicket('tk', 'AgentK', 'th3'),
      makeTicket('tl', 'AgentL', 'th4'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    const hiEdge = result.agentDependencyEdges.find(
      (e) => e.blockingAgent === 'AgentH' && e.waitingAgent === 'AgentI',
    );
    expect(hiEdge).toBeDefined();
    expect(hiEdge!.severity).toBe('low');
    expect(hiEdge!.blockingScore).toBeGreaterThan(0);
    expect(hiEdge!.blockingScore).toBeLessThan(25);
  });

  it('sorts edges: critical before high before moderate', async () => {
    // Critical: A→B, 2 blocked by ta → score 100
    // High: C→D, 1 blocked by tc → score 68
    // Moderate: E→F, E has 2 tickets, 1 blocked each → score 38
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('ta', 'AgentA', null),
      makeTicket('tb1', 'AgentB', 'ta'),
      makeTicket('tb2', 'AgentB', 'ta'),
      makeTicket('tc', 'AgentC', null),
      makeTicket('td', 'AgentD', 'tc'),
      makeTicket('te1', 'AgentE', null),
      makeTicket('te2', 'AgentE', null),
      makeTicket('tf', 'AgentF', 'te1'),
      makeTicket('tg', 'AgentG', 'te2'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    const sevs = result.agentDependencyEdges.map((e) => e.severity);
    const critIdx = sevs.indexOf('critical');
    const highIdx = sevs.indexOf('high');
    const modIdx = sevs.indexOf('moderate');
    expect(critIdx).toBeGreaterThanOrEqual(0);
    expect(highIdx).toBeGreaterThanOrEqual(0);
    expect(modIdx).toBeGreaterThanOrEqual(0);
    expect(critIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(modIdx);
  });

  it('uses fallback recommendation on AI error', async () => {
    mockCreate.mockRejectedValue(new Error('AI offline'));
    (db.select as any).mockReturnValue(makeSelect([
      makeTicket('t1', 'AgentA', null),
      makeTicket('t2', 'AgentB', 't1'),
    ]));
    const result = await analyzeAgentDependencies('proj-1');
    expect(result.agentDependencyEdges[0].recommendation).toBe(
      "Prioritize the blocking agent's tickets to unblock downstream work and reduce chain delays.",
    );
    expect(result.aiSummary).toBe(
      'Resolve blocking ticket chains to improve agent throughput and reduce inter-agent wait times.',
    );
  });
});
