import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeContextUtilization } from './agent-context-utilization-service.js';

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

function makeTicket(
  id: string,
  status: string,
  assignedPersona: string | null,
  description: string | null = null,
  epicId: string | null = null,
) {
  return { id, status, assignedPersona, description, epicId };
}

function setupDb(ticketRows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(ticketRows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeContextUtilization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty profiles when no tickets assigned', async () => {
    setupDb([
      makeTicket('t1', 'in_progress', null),
      makeTicket('t2', 'in_progress', null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    expect(report.profiles).toEqual([]);
    expect(report.criticalAgents).toEqual([]);
  });

  it('correctly computes ticketsWithDescription (description.length > 50)', async () => {
    const longDesc = 'A'.repeat(51);
    const shortDesc = 'A'.repeat(10);
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentA', longDesc),
      makeTicket('t2', 'in_progress', 'AgentA', shortDesc),
      makeTicket('t3', 'in_progress', 'AgentA', null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    expect(report.profiles[0].ticketsWithDescription).toBe(1);
    expect(report.profiles[0].totalTickets).toBe(3);
  });

  it('correctly computes ticketsWithLinkedHandoffs (epicId IS NOT NULL)', async () => {
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentB', null, 'epic-1'),
      makeTicket('t2', 'in_progress', 'AgentB', null, 'epic-2'),
      makeTicket('t3', 'in_progress', 'AgentB', null, null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    expect(report.profiles[0].ticketsWithLinkedHandoffs).toBe(2);
  });

  it('contextScore is high when all tickets have desc and epic link', async () => {
    const longDesc = 'A'.repeat(500);
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentC', longDesc, 'epic-1'),
      makeTicket('t2', 'in_progress', 'AgentC', longDesc, 'epic-2'),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    const profile = report.profiles[0];
    // descRatio=1, epicRatio=1, avgLengthScore=1 → 50+30+20=100
    expect(profile.contextScore).toBe(100);
    expect(profile.contextRating).toBe('excellent');
  });

  it('contextScore is 0 when no desc and no epic link', async () => {
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentD', null, null),
      makeTicket('t2', 'in_progress', 'AgentD', 'short', null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    const profile = report.profiles[0];
    // descRatio=0, epicRatio=0, avgLengthScore~0 → score~0
    expect(profile.contextScore).toBeLessThan(5);
    expect(profile.contextRating).toBe('critical');
  });

  it('rating thresholds: >=75 excellent, >=50 good, >=25 poor, <25 critical', async () => {
    // excellent: all desc+epic+long (score=100)
    // good: just desc (descRatio=1, epicRatio=0, avgLen=0 → 50 = good)
    // poor: partial desc, no epic, no length (descRatio=0.5 → 25 = poor boundary)
    // critical: no desc, no epic, no length → 0
    const longDesc = 'A'.repeat(500);
    setupDb([
      makeTicket('t1', 'in_progress', 'Excellent', longDesc, 'epic-1'),
      makeTicket('t2', 'in_progress', 'Good', 'A'.repeat(51), null),
      makeTicket('t3', 'in_progress', 'Poor', 'A'.repeat(51), null),
      makeTicket('t4', 'in_progress', 'Poor', null, null),
      makeTicket('t5', 'in_progress', 'Critical', null, null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    const excellent = report.profiles.find(p => p.agentPersona === 'Excellent');
    const good = report.profiles.find(p => p.agentPersona === 'Good');
    const poor = report.profiles.find(p => p.agentPersona === 'Poor');
    const critical = report.profiles.find(p => p.agentPersona === 'Critical');

    expect(excellent!.contextRating).toBe('excellent');
    expect(good!.contextRating).toBe('good');
    expect(poor!.contextRating).toBe('poor');
    expect(critical!.contextRating).toBe('critical');
  });

  it('excludes done and backlog tickets from analysis', async () => {
    const longDesc = 'A'.repeat(200);
    setupDb([
      makeTicket('t1', 'done', 'AgentE', longDesc, 'epic-1'),
      makeTicket('t2', 'backlog', 'AgentE', longDesc, 'epic-2'),
      makeTicket('t3', 'in_progress', 'AgentE', null, null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    const profile = report.profiles.find(p => p.agentPersona === 'AgentE');
    expect(profile!.totalTickets).toBe(1);
    expect(profile!.ticketsWithDescription).toBe(0);
    expect(profile!.ticketsWithLinkedHandoffs).toBe(0);
  });

  it('criticalAgents list contains only critical-rated agents', async () => {
    const longDesc = 'A'.repeat(500);
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentGood', longDesc, 'epic-1'),
      makeTicket('t2', 'in_progress', 'AgentCrit', null, null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    expect(report.criticalAgents).toContain('AgentCrit');
    expect(report.criticalAgents).not.toContain('AgentGood');
  });

  it('profiles sorted critical first then poor then good then excellent', async () => {
    const longDesc = 'A'.repeat(500);
    setupDb([
      makeTicket('t1', 'in_progress', 'AgentExcellent', longDesc, 'epic-1'),
      makeTicket('t2', 'in_progress', 'AgentCritical', null, null),
      makeTicket('t3', 'in_progress', 'AgentGood', 'A'.repeat(51), null),
      makeTicket('t4', 'in_progress', 'AgentPoor', 'A'.repeat(51), null),
      makeTicket('t5', 'in_progress', 'AgentPoor', null, null),
    ]);
    const report = await analyzeContextUtilization('proj-1');
    const ratings = report.profiles.map(p => p.contextRating);
    // critical comes before poor comes before good comes before excellent
    const critIdx = ratings.indexOf('critical');
    const poorIdx = ratings.indexOf('poor');
    const goodIdx = ratings.indexOf('good');
    const excellentIdx = ratings.indexOf('excellent');
    expect(critIdx).toBeLessThan(poorIdx);
    expect(poorIdx).toBeLessThan(goodIdx);
    expect(goodIdx).toBeLessThan(excellentIdx);
  });
});
