import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeSkillGaps } from './agent-skill-gap-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function makeSelect(rows: object[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeTicket(overrides: {
  id?: string;
  status?: string;
  assignedPersona?: string | null;
  labels?: string[];
  updatedAt?: Date | null;
}) {
  return {
    id: overrides.id ?? 'ticket-1',
    status: overrides.status ?? 'backlog',
    assignedPersona: overrides.assignedPersona ?? null,
    labels: overrides.labels ?? [],
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeSkillGaps', () => {
  it('returns empty skillGaps when no tickets', async () => {
    Object.assign(db, makeSelect([]));
    const report = await analyzeSkillGaps('proj-1');
    expect(report.skillGaps).toHaveLength(0);
    expect(report.totalLabels).toBe(0);
  });

  it('label with no completed tickets has completionRate 0', async () => {
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'in_progress', labels: ['frontend'] }),
      makeTicket({ id: 't2', status: 'backlog', labels: ['frontend'] }),
      makeTicket({ id: 't3', status: 'review', labels: ['frontend'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'frontend');
    expect(gap).toBeDefined();
    expect(gap!.completionRate).toBe(0);
    expect(gap!.completedTickets).toBe(0);
  });

  it('critical gap: completionRate < 0.2 AND totalTickets >= 3', async () => {
    // 0 done out of 4 = rate 0 < 0.2, total 4 >= 3 → critical
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'backlog', labels: ['backend'] }),
      makeTicket({ id: 't2', status: 'backlog', labels: ['backend'] }),
      makeTicket({ id: 't3', status: 'in_progress', labels: ['backend'] }),
      makeTicket({ id: 't4', status: 'review', labels: ['backend'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'backend');
    expect(gap).toBeDefined();
    expect(gap!.gapSeverity).toBe('critical');
  });

  it('high gap: completionRate < 0.4 AND totalTickets >= 2', async () => {
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'done', labels: ['devops'], assignedPersona: 'AgentA' }),
      makeTicket({ id: 't2', status: 'backlog', labels: ['devops'] }),
      makeTicket({ id: 't3', status: 'backlog', labels: ['devops'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'devops');
    expect(gap).toBeDefined();
    // completionRate = 1/3 ≈ 0.333 < 0.4, totalTickets = 3 >= 2 → high
    expect(gap!.gapSeverity).toBe('high');
  });

  it('moderate gap: completionRate < 0.6 AND coveredByAgents.length <= 1', async () => {
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'done', labels: ['testing'], assignedPersona: 'AgentA' }),
      makeTicket({ id: 't2', status: 'done', labels: ['testing'], assignedPersona: 'AgentA' }),
      makeTicket({ id: 't3', status: 'in_progress', labels: ['testing'] }),
      makeTicket({ id: 't4', status: 'backlog', labels: ['testing'] }),
      makeTicket({ id: 't5', status: 'backlog', labels: ['testing'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'testing');
    expect(gap).toBeDefined();
    // completionRate = 2/5 = 0.4 — not critical (totalTickets=5 but rate=0.4, not <0.2)
    // not high (rate=0.4 = exactly 0.4, not < 0.4)
    // moderate: rate < 0.6 AND coveredByAgents.length = 1 <= 1
    expect(gap!.gapSeverity).toBe('moderate');
    expect(gap!.coveredByAgents).toEqual(['AgentA']);
  });

  it('coveredByAgents only includes agents with done tickets', async () => {
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'done', labels: ['api'], assignedPersona: 'AgentA' }),
      makeTicket({ id: 't2', status: 'in_progress', labels: ['api'], assignedPersona: 'AgentB' }),
      makeTicket({ id: 't3', status: 'backlog', labels: ['api'], assignedPersona: 'AgentC' }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'api');
    expect(gap).toBeDefined();
    expect(gap!.coveredByAgents).toEqual(['AgentA']);
    expect(gap!.coveredByAgents).not.toContain('AgentB');
    expect(gap!.coveredByAgents).not.toContain('AgentC');
  });

  it('sort order: critical before high before moderate', async () => {
    Object.assign(db, makeSelect([
      // moderate label: 'testing' (2/5, rate=0.4, 1 agent)
      makeTicket({ id: 't1', status: 'done', labels: ['testing'], assignedPersona: 'A' }),
      makeTicket({ id: 't2', status: 'done', labels: ['testing'], assignedPersona: 'A' }),
      makeTicket({ id: 't3', status: 'in_progress', labels: ['testing'] }),
      makeTicket({ id: 't4', status: 'backlog', labels: ['testing'] }),
      makeTicket({ id: 't5', status: 'backlog', labels: ['testing'] }),
      // critical label: 'backend' (1/5, rate=0.2... wait 1/5=0.2 not < 0.2)
      // use 0/3 = 0 for critical
      makeTicket({ id: 't6', status: 'in_progress', labels: ['backend'] }),
      makeTicket({ id: 't7', status: 'backlog', labels: ['backend'] }),
      makeTicket({ id: 't8', status: 'backlog', labels: ['backend'] }),
      // high label: 'devops' (1/3 ≈ 0.333 < 0.4, >= 2)
      makeTicket({ id: 't9', status: 'done', labels: ['devops'], assignedPersona: 'B' }),
      makeTicket({ id: 't10', status: 'backlog', labels: ['devops'] }),
      makeTicket({ id: 't11', status: 'backlog', labels: ['devops'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const severities = report.skillGaps.map((g) => g.gapSeverity);
    const critIdx = severities.indexOf('critical');
    const highIdx = severities.indexOf('high');
    const modIdx = severities.indexOf('moderate');
    expect(critIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(modIdx);
  });

  it('uses fallback recommendation on AI error', async () => {
    Object.assign(db, makeSelect([
      makeTicket({ id: 't1', status: 'backlog', labels: ['frontend'] }),
      makeTicket({ id: 't2', status: 'backlog', labels: ['frontend'] }),
      makeTicket({ id: 't3', status: 'backlog', labels: ['frontend'] }),
    ]));
    const report = await analyzeSkillGaps('proj-1');
    const gap = report.skillGaps.find((g) => g.label === 'frontend');
    expect(gap).toBeDefined();
    expect(gap!.recommendation).toBe('Assign a dedicated agent to improve coverage for this skill area.');
  });
});
