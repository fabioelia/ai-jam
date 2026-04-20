import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskComplexity, computeTicketComplexity, getTier } from './agent-task-complexity-service.js';

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

function makeTicket(
  id: string,
  assignedPersona: string | null,
  epicId: string | null = null,
  priority = 'medium',
  title = 'Short title',
  description: string | null = null,
) {
  return { id, assignedPersona, epicId, priority, title, description };
}

function makeNote(
  ticketId: string,
  authorId: string,
  handoffFrom: string | null = null,
  handoffTo: string | null = null,
) {
  return { ticketId, authorId, handoffFrom, handoffTo };
}

describe('analyzeAgentTaskComplexity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty report when project has no tickets', async () => {
    setupDb([]);
    const report = await analyzeAgentTaskComplexity('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgentsAnalyzed).toBe(0);
    expect(report.summary.highestComplexityAgent).toBeNull();
    expect(report.summary.lowestComplexityAgent).toBeNull();
  });

  it('critical priority ticket produces specialist-range score', async () => {
    // base 20 + critical 30 = 50 → capable tier
    setupDb([makeTicket('t1', 'AgentA', null, 'critical')], []);
    const report = await analyzeAgentTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.personaId).toBe('AgentA');
    expect(agent.complexityScore).toBe(50);
    expect(agent.complexityTier).toBe('capable');
  });

  it('specialist tier requires score >= 70', () => {
    expect(getTier(70)).toBe('specialist');
    expect(getTier(100)).toBe('specialist');
  });

  it('low priority ticket with no description produces underutilized tier', async () => {
    // base 20 + low priority (0) = 20 → underutilized
    setupDb([makeTicket('t1', 'AgentB', null, 'low')], []);
    const report = await analyzeAgentTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.complexityScore).toBe(20);
    expect(agent.complexityTier).toBe('underutilized');
  });

  it('computeTicketComplexity formula is exact', () => {
    // base 20 + critical 30 + long desc(>500) 15 + long title(>50) 5 = 70
    const longDesc = 'x'.repeat(501);
    const longTitle = 'x'.repeat(51);
    expect(computeTicketComplexity(longTitle, longDesc, 'critical')).toBe(70);
    // base 20 + high 20 + medium desc(>200) 8 = 48
    const medDesc = 'x'.repeat(201);
    expect(computeTicketComplexity('short', medDesc, 'high')).toBe(48);
    // base 20 only (low priority, no desc, short title)
    expect(computeTicketComplexity('short', null, 'low')).toBe(20);
  });

  it('tier thresholds match spec', () => {
    expect(getTier(70)).toBe('specialist');
    expect(getTier(69)).toBe('capable');
    expect(getTier(50)).toBe('capable');
    expect(getTier(49)).toBe('generalist');
    expect(getTier(30)).toBe('generalist');
    expect(getTier(29)).toBe('underutilized');
    expect(getTier(0)).toBe('underutilized');
  });

  it('mixed tiers across multiple agents', async () => {
    // AgentA: critical → score 50 (capable), AgentB: low → score 20 (underutilized)
    setupDb(
      [makeTicket('t1', 'AgentA', null, 'critical'), makeTicket('t2', 'AgentB', null, 'low')],
      [],
    );
    const report = await analyzeAgentTaskComplexity('proj-1');
    const tiers = report.agents.map((a) => a.complexityTier);
    expect(tiers).toContain('capable');
    expect(tiers).toContain('underutilized');
  });

  it('rework rate counts tickets with more than 2 notes', async () => {
    setupDb(
      [makeTicket('t1', 'AgentC'), makeTicket('t2', 'AgentC'), makeTicket('t3', 'AgentC')],
      [
        makeNote('t1', 'a1'), makeNote('t1', 'a2'), makeNote('t1', 'a3'),
        makeNote('t2', 'a1'),
      ],
    );
    const report = await analyzeAgentTaskComplexity('proj-1');
    const agent = report.agents[0];
    expect(agent.reworkRate).toBeCloseTo(1 / 3, 2);
  });

  it('summary includes correct highestComplexityAgent and lowestComplexityAgent', async () => {
    setupDb(
      [
        makeTicket('t1', 'AgentHigh', null, 'critical', 'x'.repeat(51), 'x'.repeat(501)),
        makeTicket('t2', 'AgentLow', null, 'low'),
      ],
      [],
    );
    const report = await analyzeAgentTaskComplexity('proj-1');
    expect(report.summary.highestComplexityAgent).toBe('AgentHigh');
    expect(report.summary.lowestComplexityAgent).toBe('AgentLow');
    expect(report.summary.totalAgentsAnalyzed).toBe(2);
    expect(report.summary.avgComplexityScore).toBeGreaterThan(0);
  });
});
