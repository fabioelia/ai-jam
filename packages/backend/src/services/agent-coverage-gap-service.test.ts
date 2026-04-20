import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeCoverageGaps } from './agent-coverage-gap-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

const now = Date.now();
const FRESH = new Date(now - 10 * 60 * 60 * 1000);    // 10h ago — within 48h activity window
const STALE = new Date(now - 72 * 60 * 60 * 1000);    // 72h ago — outside 48h window

function makeTicket(
  id: string,
  status: string,
  assignedPersona: string | null,
  updatedAt: Date,
  epicId: string | null = null,
  labels: string[] = [],
) {
  return { id, status, epicId, labels, assignedPersona, updatedAt };
}

function setupDb(ticketRows: unknown[], epicRows: unknown[] = []) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(epicRows);
    }),
    innerJoin: vi.fn().mockReturnThis(),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeCoverageGaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty areas array when no active tickets', async () => {
    setupDb([]);
    const report = await analyzeCoverageGaps('proj-1');
    expect(report.areas).toEqual([]);
    expect(report.totalAreas).toBe(0);
    expect(report.coverageScore).toBe(100);
  });

  it('marks area critical when activeTickets>=3 and agentsCovering===0', async () => {
    setupDb([
      makeTicket('t1', 'in_progress', null, STALE),
      makeTicket('t2', 'in_progress', null, STALE),
      makeTicket('t3', 'in_progress', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const area = report.areas.find((a) => a.areaType === 'status' && a.areaId === 'in_progress');
    expect(area).toBeDefined();
    expect(area!.gapSeverity).toBe('critical');
    expect(area!.agentsCovering).toBe(0);
    expect(area!.activeTickets).toBe(3);
    expect(report.criticalGaps).toBe(1);
  });

  it('marks area high when activeTickets>=2 and agentsCovering===0', async () => {
    setupDb([
      makeTicket('t1', 'review', null, STALE),
      makeTicket('t2', 'review', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const area = report.areas.find((a) => a.areaId === 'review');
    expect(area).toBeDefined();
    expect(area!.gapSeverity).toBe('high');
    expect(area!.agentsCovering).toBe(0);
    expect(area!.activeTickets).toBe(2);
  });

  it('marks area high when activeTickets>=5 and agentsCovering<=1', async () => {
    // 5 tickets, 1 agent covering (FRESH), so agentsCovering=1 and high
    setupDb([
      makeTicket('t1', 'qa', 'AgentA', FRESH),
      makeTicket('t2', 'qa', null, STALE),
      makeTicket('t3', 'qa', null, STALE),
      makeTicket('t4', 'qa', null, STALE),
      makeTicket('t5', 'qa', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const area = report.areas.find((a) => a.areaId === 'qa');
    expect(area).toBeDefined();
    expect(area!.gapSeverity).toBe('high');
    expect(area!.agentsCovering).toBe(1);
    expect(area!.activeTickets).toBe(5);
  });

  it('marks area moderate when activeTickets>=1 and agentsCovering===0', async () => {
    setupDb([
      makeTicket('t1', 'backlog', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const area = report.areas.find((a) => a.areaId === 'backlog');
    expect(area).toBeDefined();
    expect(area!.gapSeverity).toBe('moderate');
    expect(area!.agentsCovering).toBe(0);
    expect(area!.activeTickets).toBe(1);
  });

  it('coverageScore = (coveredAreas/totalAreas)*100 rounded', async () => {
    // 2 status areas: 'in_progress' (3 tickets, no agent → critical)
    // and 'review' (1 ticket, 1 fresh agent → covered, no gap → not in areas[])
    // totalAreas=2, coveredAreas=1, score=50
    setupDb([
      makeTicket('t1', 'in_progress', null, STALE),
      makeTicket('t2', 'in_progress', null, STALE),
      makeTicket('t3', 'in_progress', null, STALE),
      makeTicket('t4', 'review', 'AgentA', FRESH),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    expect(report.totalAreas).toBe(2);
    expect(report.coveredAreas).toBe(1);
    expect(report.coverageScore).toBe(50);
  });

  it('sorts areas: critical→high→moderate→low then activeTickets desc within tier', async () => {
    // We need: 1 critical area, 1 high area, 1 moderate area
    // critical: 'in_progress' with 3 tickets, no agent
    // high: 'review' with 2 tickets, no agent
    // moderate: 'backlog' with 1 ticket, no agent
    // Within same tier, sort by activeTickets desc - add 2 high areas of different sizes
    setupDb([
      makeTicket('t1', 'in_progress', null, STALE),
      makeTicket('t2', 'in_progress', null, STALE),
      makeTicket('t3', 'in_progress', null, STALE),
      makeTicket('t4', 'review', null, STALE),
      makeTicket('t5', 'review', null, STALE),
      makeTicket('t6', 'backlog', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const severities = report.areas.map((a) => a.gapSeverity);
    expect(severities[0]).toBe('critical');
    expect(severities[1]).toBe('high');
    expect(severities[2]).toBe('moderate');
  });

  it('sorts within same severity tier by activeTickets desc', async () => {
    // Two moderate areas: 'backlog' has 1, 'qa' has 2 — but qa >= 2 = high, need 1 each
    // Use 'acceptance' (1 ticket) and 'backlog' (2 tickets) — wait 2 = high not moderate
    // moderate = exactly 1 ticket, agentsCovering=0
    // Let's use labeled tickets (label areas) for this:
    // label 'urgent': 1 ticket, no agent → moderate
    // label 'bug': 1 ticket, no agent → moderate
    // Both moderate, sort by activeTickets desc (tie → stable order or name)
    // Better: use two high areas with different ticket counts
    // high requires: agentsCovering===0 && tickets>=2, or agentsCovering<=1 && tickets>=5
    // 'review': 3 tickets, no agent → critical (not high)
    // Let's use critical (5 tickets) and critical (4 tickets)
    setupDb([
      makeTicket('t1', 'in_progress', null, STALE),
      makeTicket('t2', 'in_progress', null, STALE),
      makeTicket('t3', 'in_progress', null, STALE),
      makeTicket('t4', 'in_progress', null, STALE),
      makeTicket('t5', 'in_progress', null, STALE),
      makeTicket('t6', 'review', null, STALE),
      makeTicket('t7', 'review', null, STALE),
      makeTicket('t8', 'review', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    // Both critical: in_progress (5) should come before review (3)
    const criticalAreas = report.areas.filter((a) => a.gapSeverity === 'critical');
    expect(criticalAreas.length).toBe(2);
    expect(criticalAreas[0].activeTickets).toBeGreaterThanOrEqual(criticalAreas[1].activeTickets);
  });

  it('lastAgentActivity is null when no agent has touched area tickets', async () => {
    setupDb([
      makeTicket('t1', 'in_progress', null, STALE),
      makeTicket('t2', 'in_progress', null, STALE),
      makeTicket('t3', 'in_progress', null, STALE),
    ]);
    const report = await analyzeCoverageGaps('proj-1');
    const area = report.areas.find((a) => a.areaId === 'in_progress');
    expect(area).toBeDefined();
    expect(area!.lastAgentActivity).toBeNull();
  });
});
