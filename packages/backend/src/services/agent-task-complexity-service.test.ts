import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeTaskComplexity } from './agent-task-complexity-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

import { db } from '../db/connection.js';

function makeChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

function setupDb(ticketRows: unknown[], noteRows: unknown[] = []) {
  const selectMock = db.select as ReturnType<typeof vi.fn>;
  selectMock
    .mockReturnValueOnce(makeChain(ticketRows))
    .mockReturnValueOnce(makeChain(noteRows));
}

function makeTicket(id: string, assignedPersona: string | null, epicId: string | null = null) {
  return { id, assignedPersona, epicId };
}

function makeNote(
  ticketId: string,
  authorId: string,
  handoffFrom: string | null = null,
  handoffTo: string | null = null,
) {
  return { ticketId, authorId, handoffFrom, handoffTo };
}

describe('analyzeTaskComplexity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty report when project has no tickets', async () => {
    setupDb([]);
    const report = await analyzeTaskComplexity('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgentsAnalyzed).toBe(0);
    expect(report.summary.highestComplexityAgent).toBeNull();
    expect(report.summary.lowestComplexityAgent).toBeNull();
  });

  it('single agent with many notes produces high complexity', async () => {
    setupDb(
      [makeTicket('t1', 'AgentA')],
      [
        makeNote('t1', 'a1'), makeNote('t1', 'a2'), makeNote('t1', 'a3'),
        makeNote('t1', 'a4'), makeNote('t1', 'a5'), makeNote('t1', 'a6'),
        makeNote('t1', 'a7'), makeNote('t1', 'a8'),
      ],
    );
    const report = await analyzeTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.personaId).toBe('AgentA');
    expect(agent.avgTransitionsPerTicket).toBe(8);
    // rework: 1 ticket with >2 notes → reworkRate=1.0
    expect(agent.reworkRate).toBe(1);
    expect(agent.complexityTier).toMatch(/high|very-high/);
  });

  it('single agent with no notes produces low complexity', async () => {
    setupDb([makeTicket('t1', 'AgentB')], []);
    const report = await analyzeTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.avgTransitionsPerTicket).toBe(0);
    expect(agent.reworkRate).toBe(0);
    expect(agent.complexityScore).toBe(0);
    expect(agent.complexityTier).toBe('low');
  });

  it('mixed tiers across multiple agents', async () => {
    setupDb(
      [makeTicket('t1', 'Heavy'), makeTicket('t2', 'Light')],
      [
        makeNote('t1', 'a1'), makeNote('t1', 'a2'), makeNote('t1', 'a3'),
        makeNote('t1', 'a4'), makeNote('t1', 'a5'), makeNote('t1', 'a6'),
        makeNote('t1', 'a7'), makeNote('t1', 'a8'),
      ],
    );
    const report = await analyzeTaskComplexity('proj-1');
    const tiers = report.agents.map((a) => a.complexityTier);
    expect(tiers).toContain('low');
    expect(tiers.some((t) => t === 'high' || t === 'very-high')).toBe(true);
  });

  it('rework rate counts tickets with more than 2 notes', async () => {
    setupDb(
      [makeTicket('t1', 'AgentC'), makeTicket('t2', 'AgentC'), makeTicket('t3', 'AgentC')],
      [
        makeNote('t1', 'a1'), makeNote('t1', 'a2'), makeNote('t1', 'a3'), // 3 notes → rework
        makeNote('t2', 'a1'), // 1 note → no rework
        // t3: 0 notes → no rework
      ],
    );
    const report = await analyzeTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.reworkRate).toBeCloseTo(1 / 3, 2);
  });

  it('avgHandoffChainDepth counts unique authorIds from handoff notes per ticket', async () => {
    setupDb(
      [makeTicket('t1', 'AgentD')],
      [
        makeNote('t1', 'persona-1', 'prev', null),
        makeNote('t1', 'persona-2', null, 'next'),
        makeNote('t1', 'persona-1', 'prev', 'next'), // duplicate persona-1
      ],
    );
    const report = await analyzeTaskComplexity('proj-1');
    const agent = report.agents[0];
    // unique personas: persona-1, persona-2 → depth = 2
    expect(agent.avgHandoffChainDepth).toBe(2);
  });

  it('transitions normalization clamps at 8 (100)', async () => {
    // 10 notes → clamped to 100, same as 8 notes
    const notes10 = Array.from({ length: 10 }, (_, i) => makeNote('t1', `a${i}`));
    const notes8 = Array.from({ length: 8 }, (_, i) => makeNote('t2', `a${i}`));
    setupDb([makeTicket('t1', 'AgentE'), makeTicket('t2', 'AgentF')], [...notes10, ...notes8]);
    const report = await analyzeTaskComplexity('proj-1');
    const e = report.agents.find((a) => a.personaId === 'AgentE')!;
    const f = report.agents.find((a) => a.personaId === 'AgentF')!;
    // both should yield same normalized transitions component (100)
    // rework and handoff are same too, so scores should be equal
    expect(e.complexityScore).toBe(f.complexityScore);
  });

  it('epic link rate calculates correctly', async () => {
    setupDb(
      [makeTicket('t1', 'AgentG', 'epic-1'), makeTicket('t2', 'AgentG', null)],
      [],
    );
    const report = await analyzeTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.epicLinkRate).toBeCloseTo(0.5, 2);
    // epicLinkRate contributes 10%: 0.10 * 50 = 5 points
    expect(agent.complexityScore).toBe(5);
  });

  it('summary includes correct highestComplexityAgent and lowestComplexityAgent', async () => {
    setupDb(
      [makeTicket('t1', 'AgentHigh'), makeTicket('t2', 'AgentLow')],
      [
        makeNote('t1', 'a1'), makeNote('t1', 'a2'), makeNote('t1', 'a3'),
        makeNote('t1', 'a4'), makeNote('t1', 'a5'), makeNote('t1', 'a6'),
        makeNote('t1', 'a7'), makeNote('t1', 'a8'),
      ],
    );
    const report = await analyzeTaskComplexity('proj-1');
    expect(report.summary.highestComplexityAgent).toBe('AgentHigh');
    expect(report.summary.lowestComplexityAgent).toBe('AgentLow');
    expect(report.summary.totalAgentsAnalyzed).toBe(2);
    expect(report.summary.avgComplexityScore).toBeGreaterThan(0);
  });
});
