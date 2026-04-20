import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeContextSwitchCost } from './agent-context-switch-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","recommendations":["group tasks"]}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}
function makeTicket(id: string, assignedPersona: string | null, epicId: string | null, createdDaysAgo = 1) {
  return {
    id,
    assignedPersona,
    epicId,
    createdAt: new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000),
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeContextSwitchCost', () => {
  it('returns empty when no tickets', async () => {
    mockDb([]);
    const result = await analyzeContextSwitchCost('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.totalSwitches).toBe(0);
    expect(result.mostScatteredAgent).toBeNull();
  });

  it('no context switches when all tickets in same epic', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'epic-1', 3),
      makeTicket('t2', 'alice', 'epic-1', 2),
      makeTicket('t3', 'alice', 'epic-1', 1),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.contextSwitches).toBe(0);
    expect(alice?.switchRate).toBe(0);
    expect(alice?.focusScore).toBe(1);
    expect(alice?.rating).toBe('focused');
  });

  it('detects context switches between different epics', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'epic-1', 3),
      makeTicket('t2', 'alice', 'epic-2', 2), // switch
      makeTicket('t3', 'alice', 'epic-1', 1), // switch
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.contextSwitches).toBe(2);
  });

  it('computes switchRate = contextSwitches / max(1, totalTickets-1)', async () => {
    // 2 switches, 3 tickets → switchRate = 2/2 = 1.0
    mockDb([
      makeTicket('t1', 'alice', 'epic-1', 3),
      makeTicket('t2', 'alice', 'epic-2', 2),
      makeTicket('t3', 'alice', 'epic-3', 1),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.switchRate).toBe(1);
    expect(alice?.focusScore).toBe(0);
  });

  it('rating chaotic when focusScore < 0.25', async () => {
    // focusScore=0 → chaotic
    mockDb([
      makeTicket('t1', 'alice', 'epic-1', 3),
      makeTicket('t2', 'alice', 'epic-2', 2),
      makeTicket('t3', 'alice', 'epic-3', 1),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.rating).toBe('chaotic');
  });

  it('sorts chaotic before focused', async () => {
    mockDb([
      makeTicket('t1', 'focused', 'epic-1', 3),
      makeTicket('t2', 'focused', 'epic-1', 2),
      makeTicket('t3', 'chaotic', 'epic-1', 3),
      makeTicket('t4', 'chaotic', 'epic-2', 2),
      makeTicket('t5', 'chaotic', 'epic-3', 1),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    expect(result.agents[0].agentPersona).toBe('chaotic');
    expect(result.agents[1].agentPersona).toBe('focused');
  });

  it('computes dominantEpic as epicId with most tickets', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'epic-1', 4),
      makeTicket('t2', 'alice', 'epic-1', 3),
      makeTicket('t3', 'alice', 'epic-2', 2),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.dominantEpic).toBe('epic-1');
  });

  it('computes focusedAgentCount correctly', async () => {
    mockDb([
      makeTicket('t1', 'a', 'epic-1', 2),
      makeTicket('t2', 'a', 'epic-1', 1),
      makeTicket('t3', 'b', 'epic-1', 2),
      makeTicket('t4', 'b', 'epic-2', 1),
    ]);
    const result = await analyzeContextSwitchCost('proj-1');
    // 'a' has no switches → focused; 'b' has 1/1 = 1.0 switchRate → chaotic
    expect(result.focusedAgentCount).toBe(1);
  });
});
