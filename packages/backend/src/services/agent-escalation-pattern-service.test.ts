import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeEscalationPatterns } from './agent-escalation-pattern-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

const mockSelect = db.select as ReturnType<typeof vi.fn>;

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

// Build a two-call select mock: first call = tickets, second call = ticketNotes
function buildSelects(
  ticketRows: { id: string; title: string; status: string; updatedAt: Date }[],
  noteRows: { id: string; ticketId: string; handoffFrom: string | null; handoffTo: string | null; createdAt: Date }[],
) {
  let call = 0;
  mockSelect.mockImplementation(() => {
    call++;
    if (call === 1) {
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(ticketRows) }) };
    }
    return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(noteRows) }) };
  });
}

function makeNote(
  id: string,
  ticketId: string,
  handoffFrom: string | null,
  handoffTo: string | null,
  createdAt: Date,
) {
  return { id, ticketId, handoffFrom, handoffTo, createdAt };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeEscalationPatterns', () => {
  it('empty project returns zero totals and empty arrays', async () => {
    buildSelects([], []);
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.totalEscalations).toBe(0);
    expect(result.chains).toHaveLength(0);
    expect(result.hotspots).toHaveLength(0);
    expect(result.circularPatterns).toHaveLength(0);
    expect(result.avgChainLength).toBe(0);
  });

  it('single escalation creates one chain edge and one hotspot', async () => {
    // A→B handoff, then B→C within 2h = escalation on edge B→C
    buildSelects(
      [{ id: 't1', title: 'Ticket 1', status: 'in_progress', updatedAt: now }],
      [
        makeNote('n1', 't1', 'AgentA', 'AgentB', hoursAgo(3)),
        makeNote('n2', 't1', 'AgentB', 'AgentC', hoursAgo(2.5)), // 0.5h gap → escalation
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.totalEscalations).toBe(1);
    expect(result.chains).toHaveLength(1);
    expect(result.chains[0].fromAgent).toBe('AgentB');
    expect(result.chains[0].toAgent).toBe('AgentC');
    expect(result.chains[0].count).toBe(1);
    expect(result.hotspots).toHaveLength(1);
    expect(result.hotspots[0].agentId).toBe('AgentB');
    expect(result.hotspots[0].escalationsSent).toBe(1);
  });

  it('cycle detection: A→B→A returns circular pattern [A, B, A]', async () => {
    // Ticket1: A→B (escalation edge A→B)
    // Ticket2: B→A (escalation edge B→A)
    buildSelects(
      [
        { id: 't1', title: 'T1', status: 'in_progress', updatedAt: now },
        { id: 't2', title: 'T2', status: 'in_progress', updatedAt: now },
      ],
      [
        // Ticket1: note from X to A, then A escalates to B within 2h
        makeNote('n1', 't1', 'AgentX', 'AgentA', hoursAgo(5)),
        makeNote('n2', 't1', 'AgentA', 'AgentB', hoursAgo(4.5)),
        // Ticket2: note from X to B, then B escalates to A within 2h
        makeNote('n3', 't2', 'AgentX', 'AgentB', hoursAgo(3)),
        makeNote('n4', 't2', 'AgentB', 'AgentA', hoursAgo(2.5)),
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.circularPatterns.length).toBeGreaterThan(0);
    const cycle = result.circularPatterns[0];
    // cycle starts with lex-smallest agent and wraps: AgentA → AgentB → AgentA
    expect(cycle[0]).toBe('AgentA');
    expect(cycle[cycle.length - 1]).toBe('AgentA');
    expect(cycle).toContain('AgentB');
  });

  it('severity thresholds: rate=65→critical, rate=45→high, rate=25→moderate, rate=5→low', async () => {
    // Build agents with specific escalation rates by controlling handoff counts
    // Agent with 65% escalation rate: 13 escalations out of 20 handoffs
    // We use 4 tickets, each with carefully crafted gaps
    const tickets = [
      { id: 'tcrit', title: 'Crit', status: 'in_progress', updatedAt: now },
      { id: 'thigh', title: 'High', status: 'in_progress', updatedAt: now },
      { id: 'tmod', title: 'Mod', status: 'in_progress', updatedAt: now },
      { id: 'tlow', title: 'Low', status: 'in_progress', updatedAt: now },
    ];

    // CritAgent: 13 escalations / 20 handoffs = 65% → critical
    // We'll simplify: each agent has exactly 1 ticket, rate computed from 1 escalation / N handoffs
    // critical: 1 escalation / 1 handoff = 100% (>= 60) → critical
    const notes = [
      // CritAgent: 1 total handoff from CritAgent, 1 escalation sent → 100% → critical
      makeNote('nc1', 'tcrit', 'Setup', 'CritAgent', hoursAgo(10)),
      makeNote('nc2', 'tcrit', 'CritAgent', 'Someone', hoursAgo(9.5)), // escalation

      // HighAgent: 2 handoffs from HighAgent, 1 escalation → 50% → high (>=40)
      makeNote('nh1', 'thigh', 'Setup', 'HighAgent', hoursAgo(10)),
      makeNote('nh2', 'thigh', 'HighAgent', 'Someone', hoursAgo(9.5)), // escalation
      makeNote('nh3', 'thigh', 'HighAgent', 'Done', hoursAgo(5)),      // NOT escalation (>2h gap)

      // ModAgent: 4 handoffs from ModAgent, 1 escalation → 25% → moderate (>=20)
      makeNote('nm1', 'tmod', 'Setup', 'ModAgent', hoursAgo(10)),
      makeNote('nm2', 'tmod', 'ModAgent', 'Someone', hoursAgo(9.5)), // escalation
      makeNote('nm3', 'tmod', 'ModAgent', 'Done', hoursAgo(5)),      // NOT escalation (>2h gap)
      makeNote('nm4', 'tmod', 'ModAgent', 'Done2', hoursAgo(3)),     // NOT escalation (>2h gap)
      makeNote('nm5', 'tmod', 'ModAgent', 'Done3', hoursAgo(1)),     // NOT escalation (>2h gap)

      // LowAgent: 20 handoffs from LowAgent, 1 escalation → 5% → low (<20, >0)
      // Use 20 notes from LowAgent with only 1 escalation
      ...Array.from({ length: 19 }, (_, i) =>
        makeNote(`nl${i}`, 'tlow', 'LowAgent', `Tgt${i}`, hoursAgo(20 - i)),
      ),
      // 1 escalation: prev note ends with handoffTo=LowAgent, then LowAgent sends within 2h
      makeNote('nle0', 'tlow', 'Setup', 'LowAgent', hoursAgo(21)),
      makeNote('nle1', 'tlow', 'LowAgent', 'EscTgt', hoursAgo(20.5)), // escalation (0.5h gap)
    ];

    buildSelects(tickets, notes);
    const result = await analyzeEscalationPatterns('proj1');
    const findSeverity = (id: string) => result.hotspots.find((h) => h.agentId === id)?.severity;

    expect(findSeverity('CritAgent')).toBe('critical');
    expect(findSeverity('HighAgent')).toBe('high');
    expect(findSeverity('ModAgent')).toBe('moderate');
    expect(findSeverity('LowAgent')).toBe('low');
  });

  it('chains sorted by count desc: higher count appears first', async () => {
    buildSelects(
      [
        { id: 't1', title: 'T1', status: 'in_progress', updatedAt: now },
        { id: 't2', title: 'T2', status: 'in_progress', updatedAt: now },
        { id: 't3', title: 'T3', status: 'in_progress', updatedAt: now },
      ],
      [
        // Edge A→B: 2 tickets
        makeNote('n1', 't1', 'X', 'AgentA', hoursAgo(10)),
        makeNote('n2', 't1', 'AgentA', 'AgentB', hoursAgo(9.5)),
        makeNote('n3', 't2', 'X', 'AgentA', hoursAgo(8)),
        makeNote('n4', 't2', 'AgentA', 'AgentB', hoursAgo(7.5)),
        // Edge C→D: 1 ticket
        makeNote('n5', 't3', 'X', 'AgentC', hoursAgo(6)),
        makeNote('n6', 't3', 'AgentC', 'AgentD', hoursAgo(5.5)),
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.chains[0].count).toBeGreaterThanOrEqual(result.chains[1].count);
    expect(result.chains[0].fromAgent).toBe('AgentA');
    expect(result.chains[0].toAgent).toBe('AgentB');
  });

  it('hotspots sorted by escalationRate desc: higher rate appears first', async () => {
    buildSelects(
      [
        { id: 't1', title: 'T1', status: 'in_progress', updatedAt: now },
        { id: 't2', title: 'T2', status: 'in_progress', updatedAt: now },
      ],
      [
        // HighRateAgent: 1/1 handoffs escalated = 100%
        makeNote('n1', 't1', 'X', 'HighRateAgent', hoursAgo(5)),
        makeNote('n2', 't1', 'HighRateAgent', 'Tgt', hoursAgo(4.5)),
        // LowRateAgent: 1 escalation out of 3 handoffs = 33%
        makeNote('n3', 't2', 'X', 'LowRateAgent', hoursAgo(5)),
        makeNote('n4', 't2', 'LowRateAgent', 'Tgt', hoursAgo(4.5)), // escalation
        makeNote('n5', 't2', 'LowRateAgent', 'Tgt2', hoursAgo(2)),   // no escalation (>2h gap)
        makeNote('n6', 't2', 'LowRateAgent', 'Tgt3', hoursAgo(1)),   // no escalation (>2h gap)
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.hotspots[0].escalationRate).toBeGreaterThanOrEqual(result.hotspots[1].escalationRate);
    expect(result.hotspots[0].agentId).toBe('HighRateAgent');
  });

  it('avgResolutionTime is null when ticket still open', async () => {
    buildSelects(
      [{ id: 't1', title: 'Open Ticket', status: 'in_progress', updatedAt: now }],
      [
        makeNote('n1', 't1', 'X', 'AgentA', hoursAgo(5)),
        makeNote('n2', 't1', 'AgentA', 'AgentB', hoursAgo(4.5)),
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.chains[0].avgResolutionTime).toBeNull();
  });

  it('totalEscalations counts distinct escalation handoffs', async () => {
    buildSelects(
      [
        { id: 't1', title: 'T1', status: 'in_progress', updatedAt: now },
        { id: 't2', title: 'T2', status: 'in_progress', updatedAt: now },
      ],
      [
        // Ticket 1: 2 escalation hops
        makeNote('n1', 't1', 'X', 'AgentA', hoursAgo(6)),
        makeNote('n2', 't1', 'AgentA', 'AgentB', hoursAgo(5.5)), // escalation 1
        makeNote('n3', 't1', 'AgentB', 'AgentC', hoursAgo(5)),   // escalation 2
        // Ticket 2: 1 escalation
        makeNote('n4', 't2', 'X', 'AgentA', hoursAgo(4)),
        makeNote('n5', 't2', 'AgentA', 'AgentB', hoursAgo(3.5)), // escalation 3
      ],
    );
    const result = await analyzeEscalationPatterns('proj1');
    expect(result.totalEscalations).toBe(3);
  });
});
