import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockFrom, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockSelect, mockFrom, mockWhere };
});

vi.mock('../db/connection.js', () => ({
  db: { select: mockSelect },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock AI summary.' }],
      }),
    };
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

import { analyzeAgentReassignmentRates, computeAgentMetrics } from './agent-reassignment-rate-service.js';

type NoteRow = {
  id: string;
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  projectId: string;
};

const now = new Date('2026-01-20T12:00:00Z');
function hoursAgo(h: number) { return new Date(now.getTime() - h * 3600000); }

function makeNote(id: string, ticketId: string, handoffFrom: string | null, handoffTo: string | null, createdAt = now): NoteRow {
  return { id, ticketId, handoffFrom, handoffTo, createdAt };
}

function makeTicket(id: string, assignedPersona: string | null, projectId = 'proj-1'): TicketRow {
  return { id, assignedPersona, projectId };
}

describe('analyzeAgentReassignmentRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  // Test 1: Returns empty report when no ticketNotes
  it('returns empty report when no ticketNotes', async () => {
    mockWhere
      .mockResolvedValueOnce([]) // notes
      .mockResolvedValueOnce([]); // tickets

    const report = await analyzeAgentReassignmentRates('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.hotspots).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.totalReassignments).toBe(0);
    expect(report.summary.avgReassignmentAwayRate).toBe(0);
    expect(report.summary.mostStableAgent).toBeNull();
    expect(report.summary.mostVolatileAgent).toBeNull();
  });

  // Test 2: Returns empty when ticketNotes exist but no handoffFrom/handoffTo data
  it('returns empty agents when notes have no handoffFrom/handoffTo', async () => {
    const notes: NoteRow[] = [
      makeNote('n1', 't1', null, null),
      makeNote('n2', 't1', null, 'AgentB'),
    ];
    const ticketList: TicketRow[] = [
      makeTicket('t1', null),
    ];
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalReassignments).toBe(0);
  });

  // Test 3: Correctly counts ticketsReassignedAway for an agent
  it('correctly counts ticketsReassignedAway for an agent', async () => {
    const notes: NoteRow[] = [
      makeNote('n1', 't1', 'AgentA', 'AgentB'),
      makeNote('n2', 't2', 'AgentA', 'AgentC'),
      makeNote('n3', 't1', 'AgentB', 'AgentC'), // AgentB reassigned away t1
    ];
    const ticketList: TicketRow[] = [
      makeTicket('t1', 'AgentA'),
      makeTicket('t2', 'AgentA'),
    ];
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    const agentA = report.agents.find(a => a.agentPersona === 'AgentA');
    expect(agentA).toBeDefined();
    expect(agentA!.ticketsReassignedAway).toBe(2); // t1 and t2
  });

  // Test 4: Correctly counts ticketsReassignedIn for an agent
  it('correctly counts ticketsReassignedIn for an agent', async () => {
    const notes: NoteRow[] = [
      makeNote('n1', 't1', 'AgentA', 'AgentB'),
      makeNote('n2', 't2', 'AgentC', 'AgentB'),
      makeNote('n3', 't3', 'AgentD', 'AgentB'),
    ];
    const ticketList: TicketRow[] = [
      makeTicket('t1', 'AgentA'),
      makeTicket('t2', 'AgentC'),
      makeTicket('t3', 'AgentD'),
    ];
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    const agentB = report.agents.find(a => a.agentPersona === 'AgentB');
    expect(agentB).toBeDefined();
    expect(agentB!.ticketsReassignedIn).toBe(3); // t1, t2, t3
  });

  // Test 5: Correctly classifies stabilityLevel
  it('correctly classifies stabilityLevel for stable/moderate/volatile/critical', async () => {
    const tickets4 = [
      makeTicket('t1', 'AgentA'),
      makeTicket('t2', 'AgentA'),
      makeTicket('t3', 'AgentA'),
      makeTicket('t4', 'AgentA'),
    ];

    // stable: rate = 0 → score = 100
    const metricsStable = computeAgentMetrics('AgentA', [], tickets4);
    expect(metricsStable.stabilityLevel).toBe('stable');
    expect(metricsStable.stabilityScore).toBe(100);

    // volatile: 5/10 = 0.5 rate → score = 50
    const notes5 = [
      makeNote('n1', 't1', 'AgentA', 'AgentB'),
      makeNote('n2', 't2', 'AgentA', 'AgentB'),
      makeNote('n3', 't3', 'AgentA', 'AgentB'),
      makeNote('n4', 't4', 'AgentA', 'AgentB'),
      makeNote('n5', 't5', 'AgentA', 'AgentB'),
    ];
    const tickets10 = Array.from({ length: 10 }, (_, i) => makeTicket(`t${i + 1}`, 'AgentA'));
    const metricsVolatile = computeAgentMetrics('AgentA', notes5, tickets10);
    expect(metricsVolatile.stabilityLevel).toBe('volatile');

    // critical: 7/10 = 0.7 rate → score = 30
    const notes7 = Array.from({ length: 7 }, (_, i) =>
      makeNote(`n${i + 1}`, `t${i + 1}`, 'AgentA', 'AgentB')
    );
    const metricsAlt = computeAgentMetrics('AgentA', notes7, tickets10);
    expect(metricsAlt.stabilityLevel).toBe('critical');
  });

  // Test 6: Sorts agents by reassignmentAwayRate desc, then ticketsReceived desc
  it('sorts agents by reassignmentAwayRate desc then ticketsReceived desc', async () => {
    const notes: NoteRow[] = [
      makeNote('n1', 't1', 'AgentA', 'AgentC'), // AgentA: 1/2 = 0.5
      makeNote('n2', 't2', 'AgentB', 'AgentC'), // AgentB: 1/1 = 1.0
    ];
    const ticketList: TicketRow[] = [
      makeTicket('t1', 'AgentA'),
      makeTicket('t2', 'AgentA'), // AgentA has 2 tickets received
      makeTicket('t3', 'AgentB'), // AgentB has 1 ticket received
    ];
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    expect(report.agents[0].agentPersona).toBe('AgentB'); // higher rate
    expect(report.agents[1].agentPersona).toBe('AgentA');
  });

  // Test 7: Correctly builds hotspots (top 5 by count, sorted desc)
  it('builds hotspots top 5 sorted by count desc', async () => {
    const notes: NoteRow[] = [
      // A→B: 3
      makeNote('n1', 't1', 'AgentA', 'AgentB'),
      makeNote('n2', 't2', 'AgentA', 'AgentB'),
      makeNote('n3', 't3', 'AgentA', 'AgentB'),
      // C→D: 5
      makeNote('n4', 't4', 'AgentC', 'AgentD'),
      makeNote('n5', 't5', 'AgentC', 'AgentD'),
      makeNote('n6', 't6', 'AgentC', 'AgentD'),
      makeNote('n7', 't7', 'AgentC', 'AgentD'),
      makeNote('n8', 't8', 'AgentC', 'AgentD'),
      // E→F: 1
      makeNote('n9', 't9', 'AgentE', 'AgentF'),
      // G→H: 2
      makeNote('n10', 't10', 'AgentG', 'AgentH'),
      makeNote('n11', 't11', 'AgentG', 'AgentH'),
      // I→J: 4
      makeNote('n12', 't12', 'AgentI', 'AgentJ'),
      makeNote('n13', 't13', 'AgentI', 'AgentJ'),
      makeNote('n14', 't14', 'AgentI', 'AgentJ'),
      makeNote('n15', 't15', 'AgentI', 'AgentJ'),
      // K→L: 6 (would be 6th if not top 5)
      makeNote('n16', 't16', 'AgentK', 'AgentL'),
      makeNote('n17', 't17', 'AgentK', 'AgentL'),
      makeNote('n18', 't18', 'AgentK', 'AgentL'),
      makeNote('n19', 't19', 'AgentK', 'AgentL'),
      makeNote('n20', 't20', 'AgentK', 'AgentL'),
      makeNote('n21', 't21', 'AgentK', 'AgentL'),
    ];
    const ticketList = Array.from({ length: 21 }, (_, i) => makeTicket(`t${i + 1}`, null));
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    expect(report.hotspots).toHaveLength(5);
    expect(report.hotspots[0].count).toBeGreaterThanOrEqual(report.hotspots[1].count);
    expect(report.hotspots[1].count).toBeGreaterThanOrEqual(report.hotspots[2].count);
    // K→L (6) should be first
    expect(report.hotspots[0].fromPersona).toBe('AgentK');
    expect(report.hotspots[0].toPersona).toBe('AgentL');
  });

  // Test 8: Correctly identifies mostStableAgent and mostVolatileAgent (min 2 tickets received)
  it('identifies mostStableAgent and mostVolatileAgent with min 2 tickets received', async () => {
    const notes: NoteRow[] = [
      // AgentA reassigns 1/3 = 0.333 rate → score ~67 moderate
      makeNote('n1', 't1', 'AgentA', 'AgentC'),
      // AgentB reassigns 3/3 = 1.0 rate → score 0 critical
      makeNote('n2', 't2', 'AgentB', 'AgentC'),
      makeNote('n3', 't3', 'AgentB', 'AgentC'),
      makeNote('n4', 't4', 'AgentB', 'AgentC'),
    ];
    const ticketList: TicketRow[] = [
      makeTicket('t1', 'AgentA'),
      makeTicket('t5', 'AgentA'),
      makeTicket('t6', 'AgentA'),
      makeTicket('t2', 'AgentB'),
      makeTicket('t3', 'AgentB'),
      makeTicket('t4', 'AgentB'),
    ];
    mockWhere
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce(ticketList);

    const report = await analyzeAgentReassignmentRates('proj-1');
    // AgentC only received tickets but has 0 reassigned away
    expect(report.summary.mostStableAgent).toBeDefined();
    expect(report.summary.mostVolatileAgent).toBeDefined();
    // AgentB has worst stability
    expect(report.summary.mostVolatileAgent).toBe('AgentB');
  });

  // Test 9: Boundary - stabilityScore exactly 60 → 'moderate' (not volatile)
  it('boundary: stabilityScore exactly 60 is moderate not volatile', () => {
    // stabilityScore = 100 - (0.4 * 100) = 60 → moderate
    const notes5 = Array.from({ length: 4 }, (_, i) =>
      makeNote(`n${i + 1}`, `t${i + 1}`, 'AgentA', 'AgentB')
    );
    const tickets10 = Array.from({ length: 10 }, (_, i) => makeTicket(`t${i + 1}`, 'AgentA'));
    const metrics = computeAgentMetrics('AgentA', notes5, tickets10);
    expect(metrics.reassignmentAwayRate).toBe(0.4);
    expect(metrics.stabilityScore).toBe(60);
    expect(metrics.stabilityLevel).toBe('moderate');
  });
});
