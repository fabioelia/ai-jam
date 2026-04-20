import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeParallelCapacity } from './agent-parallel-capacity-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","recommendations":["reduce load"]}' }] }) },
    };
  }),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}
function makeTicket(id: string, assignedPersona: string | null, status: string) {
  return { id, assignedPersona, status };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeParallelCapacity', () => {
  it('returns empty result when no tickets', async () => {
    mockDb([]);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.maxParallelLoad).toBe(0);
    expect(result.overloadedAgentCount).toBe(0);
  });

  it('agent with 0 in_progress gets optimal rating', async () => {
    mockDb([makeTicket('t1', 'alice', 'done'), makeTicket('t2', 'alice', 'backlog')]);
    const result = await analyzeParallelCapacity('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.currentParallelCount).toBe(0);
    expect(alice?.rating).toBe('optimal');
    expect(alice?.efficiencyScore).toBe(1);
  });

  it('rating thresholds: <=2=optimal, <=4=loaded, <=6=overloaded, >6=saturated', async () => {
    const tickets = [
      // alice: 2 in_progress → optimal
      ...Array.from({ length: 2 }, (_, i) => makeTicket(`a${i}`, 'alice', 'in_progress')),
      // bob: 4 in_progress → loaded
      ...Array.from({ length: 4 }, (_, i) => makeTicket(`b${i}`, 'bob', 'in_progress')),
      // charlie: 6 in_progress → overloaded
      ...Array.from({ length: 6 }, (_, i) => makeTicket(`c${i}`, 'charlie', 'in_progress')),
      // dave: 7 in_progress → saturated
      ...Array.from({ length: 7 }, (_, i) => makeTicket(`d${i}`, 'dave', 'in_progress')),
    ];
    mockDb(tickets);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.agents.find(a => a.agentPersona === 'alice')?.rating).toBe('optimal');
    expect(result.agents.find(a => a.agentPersona === 'bob')?.rating).toBe('loaded');
    expect(result.agents.find(a => a.agentPersona === 'charlie')?.rating).toBe('overloaded');
    expect(result.agents.find(a => a.agentPersona === 'dave')?.rating).toBe('saturated');
  });

  it('sorts saturated before optimal', async () => {
    mockDb([
      ...Array.from({ length: 7 }, (_, i) => makeTicket(`s${i}`, 'saturated', 'in_progress')),
      makeTicket('o1', 'optimal', 'done'),
    ]);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.agents[0].agentPersona).toBe('saturated');
    expect(result.agents[result.agents.length - 1].agentPersona).toBe('optimal');
  });

  it('counts overloadedAgentCount = overloaded + saturated', async () => {
    mockDb([
      ...Array.from({ length: 6 }, (_, i) => makeTicket(`a${i}`, 'overloaded', 'in_progress')),
      ...Array.from({ length: 7 }, (_, i) => makeTicket(`b${i}`, 'saturated', 'in_progress')),
      makeTicket('c1', 'optimal', 'done'),
    ]);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.overloadedAgentCount).toBe(2);
  });

  it('optimalConcurrency=2 when avgParallelLoad<=3, else 1', async () => {
    // 2 agents, 1 in_progress each → avg=1 ≤ 3 → optimal=2
    mockDb([
      makeTicket('t1', 'alice', 'in_progress'),
      makeTicket('t2', 'bob', 'in_progress'),
    ]);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.optimalConcurrency).toBe(2);
  });

  it('computes avgParallelLoad correctly', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'in_progress'),
      makeTicket('t2', 'alice', 'in_progress'),
      makeTicket('t3', 'bob', 'done'),
    ]);
    // alice=2, bob=0 → avg=1
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.avgParallelLoad).toBe(1);
  });

  it('efficiencyScore = round(1/max(1,count)*100)/100', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'in_progress'),
      makeTicket('t2', 'alice', 'in_progress'),
    ]);
    const result = await analyzeParallelCapacity('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.efficiencyScore).toBe(0.5); // 1/2 = 0.5
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(function () {
      return {
        messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
      };
    });
    mockDb([makeTicket('t1', 'alice', 'in_progress')]);
    const result = await analyzeParallelCapacity('proj-1');
    expect(result.aiSummary).toBe('Review parallel task load to identify overloaded agents and optimize concurrent task distribution.');
  });
});
