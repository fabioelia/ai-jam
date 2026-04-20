import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCollaborationGraph,
  computeCollaborationStrength,
  analyzeCollaborationGraph,
  type RawHandoffRecord,
  type RawTicketRecord,
} from './agent-collaboration-graph-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","recommendations":["r1"]}' }] }) },
    };
  }),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  } as unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeCollaborationGraph', () => {
  it('returns empty report for empty project', () => {
    const result = computeCollaborationGraph([], []);
    expect(result.edges).toHaveLength(0);
    expect(result.agents).toHaveLength(0);
    expect(result.mostActiveCollaborators).toHaveLength(0);
    expect(result.networkDensity).toBe(0);
    expect(result.mostIsolatedAgent).toBe('');
  });

  it('marks single agent as isolated', () => {
    const tickets: RawTicketRecord[] = [{ id: 't1', assignedPersona: 'agent-alpha' }];
    const handoffs: RawHandoffRecord[] = [];
    const result = computeCollaborationGraph(tickets, handoffs);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].role).toBe('isolated');
    expect(result.agents[0].centralityScore).toBe(0);
    expect(result.edges).toHaveLength(0);
  });

  it('merges bidirectional handoffs into one edge (A->B + B->A = one edge)', () => {
    const tickets: RawTicketRecord[] = [
      { id: 't1', assignedPersona: 'agent-alpha' },
      { id: 't2', assignedPersona: 'agent-beta' },
    ];
    const handoffs: RawHandoffRecord[] = [
      { ticketId: 't1', handoffFrom: 'agent-alpha', handoffTo: 'agent-beta', content: 'context A', status: 'done' },
      { ticketId: 't2', handoffFrom: 'agent-beta', handoffTo: 'agent-alpha', content: 'context B', status: 'done' },
    ];
    const result = computeCollaborationGraph(tickets, handoffs);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].handoffCount).toBe(2);
    expect(result.edges[0].successfulHandoffs).toBe(2);
  });

  it('computes two-agent bidirectional report correctly', () => {
    const tickets: RawTicketRecord[] = [
      { id: 't1', assignedPersona: 'agent-alpha' },
      { id: 't2', assignedPersona: 'agent-beta' },
    ];
    const handoffs: RawHandoffRecord[] = [
      { ticketId: 't1', handoffFrom: 'agent-alpha', handoffTo: 'agent-beta', content: 'hello world', status: 'done' },
    ];
    const result = computeCollaborationGraph(tickets, handoffs);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].successRate).toBe(1);
    expect(result.agents).toHaveLength(2);
    expect(result.mostActiveCollaborators).toContain('agent-alpha');
    expect(result.mostActiveCollaborators).toContain('agent-beta');
  });

  it('identifies hub agent with many collaborators', () => {
    const tickets: RawTicketRecord[] = [
      { id: 't1', assignedPersona: 'hub' },
      { id: 't2', assignedPersona: 'a' },
      { id: 't3', assignedPersona: 'b' },
      { id: 't4', assignedPersona: 'c' },
      { id: 't5', assignedPersona: 'd' },
    ];
    // hub connects to a, b, c, d = 4 unique collaborators out of max 4 (hub sees 4, others see 1)
    const handoffs: RawHandoffRecord[] = [
      { ticketId: 't1', handoffFrom: 'hub', handoffTo: 'a', content: 'x', status: 'done' },
      { ticketId: 't2', handoffFrom: 'hub', handoffTo: 'b', content: 'x', status: 'done' },
      { ticketId: 't3', handoffFrom: 'hub', handoffTo: 'c', content: 'x', status: 'done' },
      { ticketId: 't4', handoffFrom: 'hub', handoffTo: 'd', content: 'x', status: 'done' },
    ];
    const result = computeCollaborationGraph(tickets, handoffs);
    const hubAgent = result.agents.find((ag) => ag.personaId === 'hub');
    expect(hubAgent).toBeDefined();
    expect(hubAgent!.role).toBe('hub');
    expect(hubAgent!.centralityScore).toBe(100);
    expect(hubAgent!.uniqueCollaborators).toBe(4);
  });

  it('computes networkDensity correctly', () => {
    // 3 agents, 3 possible edges, 2 actual edges -> 66.67%
    const tickets: RawTicketRecord[] = [
      { id: 't1', assignedPersona: 'a' },
      { id: 't2', assignedPersona: 'b' },
      { id: 't3', assignedPersona: 'c' },
    ];
    const handoffs: RawHandoffRecord[] = [
      { ticketId: 't1', handoffFrom: 'a', handoffTo: 'b', content: 'x', status: 'done' },
      { ticketId: 't2', handoffFrom: 'b', handoffTo: 'c', content: 'x', status: 'done' },
    ];
    const result = computeCollaborationGraph(tickets, handoffs);
    // 3 agents -> possible edges = 3*(3-1)/2 = 3
    // 2 actual edges -> density = 2/3 * 100 = 66.67
    expect(result.networkDensity).toBeCloseTo(66.67, 1);
  });

  it('computes collaborationStrength boundary values correctly', () => {
    // successRate=1, handoffCount=10 -> (1*0.6) + (10/10*40) = 0.6 + 40 = 40.6
    expect(computeCollaborationStrength(1, 10)).toBeCloseTo(40.6, 5);
    // successRate=0, handoffCount=0 -> 0
    expect(computeCollaborationStrength(0, 0)).toBe(0);
    // successRate=0.5, handoffCount=5 -> (0.5*0.6) + (5/10*40) = 0.3 + 20 = 20.3
    expect(computeCollaborationStrength(0.5, 5)).toBeCloseTo(20.3, 5);
    // handoffCount capped at 10 -> handoffCount=20 same as 10
    expect(computeCollaborationStrength(1, 20)).toBeCloseTo(40.6, 5);
  });

  it('detects mostIsolatedAgent correctly', () => {
    const tickets: RawTicketRecord[] = [
      { id: 't1', assignedPersona: 'active' },
      { id: 't2', assignedPersona: 'loner' },
    ];
    const handoffs: RawHandoffRecord[] = [
      { ticketId: 't1', handoffFrom: 'active', handoffTo: 'active', content: 'x', status: 'done' },
    ];
    // loner has no handoffs -> centralityScore = 0, should be mostIsolatedAgent
    const result = computeCollaborationGraph(tickets, handoffs);
    expect(result.mostIsolatedAgent).toBe('loner');
  });
});

describe('analyzeCollaborationGraph integration', () => {
  it('calls db and returns report with aiSummary', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: 't1', assignedPersona: 'agent-alpha', status: 'done' }]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(makeSelectChain([{ ticketId: 't1', handoffFrom: 'agent-alpha', handoffTo: 'agent-beta', content: 'hello', status: 'done' }]) as ReturnType<typeof db.select>);

    const report = await analyzeCollaborationGraph('project-1');
    expect(report.aiSummary).toBe('ok');
    expect(report.recommendations).toEqual(['r1']);
    expect(report.edges).toBeDefined();
    expect(report.agents).toBeDefined();
  });
});
