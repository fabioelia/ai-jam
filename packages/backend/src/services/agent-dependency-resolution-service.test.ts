import { describe, it, expect } from 'vitest';
import {
  buildDependencyResolutionMetrics,
  computeResolutionScore,
  computeResolutionTier,
} from './agent-dependency-resolution-service.js';

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  blockedBy: string | null,
) {
  return { id, assignedPersona, status, blockedBy };
}

function makeSession(
  id: string,
  ticketId: string,
  personaType: string,
  status: string,
  startedAt: Date | null = null,
  completedAt: Date | null = null,
) {
  return { id, ticketId, personaType, status, startedAt, completedAt };
}

describe('computeResolutionScore', () => {
  it('gives bonus 10 when avgResolutionTime < 24h', () => {
    const score = computeResolutionScore(70, 12);
    // 70 * 0.6 + 10 = 52
    expect(score).toBe(52);
  });

  it('no bonus when avgResolutionTime >= 24h', () => {
    const score = computeResolutionScore(70, 24);
    // 70 * 0.6 = 42
    expect(score).toBe(42);
  });

  it('clamps score to 100 max', () => {
    const score = computeResolutionScore(100, 0);
    // 100 * 0.6 + 10 = 70 → not exceeds 100
    expect(score).toBe(70);
  });

  it('clamps score to 0 min', () => {
    const score = computeResolutionScore(0, 48);
    expect(score).toBe(0);
  });
});

describe('computeResolutionTier', () => {
  it('returns expert for score >= 80', () => {
    expect(computeResolutionTier(80)).toBe('expert');
    expect(computeResolutionTier(100)).toBe('expert');
  });

  it('returns proficient for score >= 60', () => {
    expect(computeResolutionTier(60)).toBe('proficient');
    expect(computeResolutionTier(79)).toBe('proficient');
  });

  it('returns developing for score >= 40', () => {
    expect(computeResolutionTier(40)).toBe('developing');
    expect(computeResolutionTier(59)).toBe('developing');
  });

  it('returns struggling for score < 40', () => {
    expect(computeResolutionTier(39)).toBe('struggling');
    expect(computeResolutionTier(0)).toBe('struggling');
  });
});

describe('buildDependencyResolutionMetrics', () => {
  it('returns empty array when no tickets or sessions', () => {
    const result = buildDependencyResolutionMetrics([], []);
    expect(result).toEqual([]);
  });

  it('counts blocked tickets per agent correctly', () => {
    const projectTickets = [
      makeTicket('t1', 'agentA', 'in_progress', 'some-dep'),
      makeTicket('t2', 'agentA', 'done', 'some-dep'),
      makeTicket('t3', 'agentA', 'todo', null),
    ];
    const result = buildDependencyResolutionMetrics(projectTickets, []);
    const agentA = result.find((a) => a.agentId === 'agentA')!;
    expect(agentA.totalDependencies).toBe(2);
    expect(agentA.resolvedDependencies).toBe(1);
  });

  it('counts acceptance status as resolved', () => {
    const projectTickets = [
      makeTicket('t1', 'agentB', 'acceptance', 'dep-1'),
      makeTicket('t2', 'agentB', 'in_progress', 'dep-2'),
    ];
    const result = buildDependencyResolutionMetrics(projectTickets, []);
    const agentB = result.find((a) => a.agentId === 'agentB')!;
    expect(agentB.resolvedDependencies).toBe(1);
    expect(agentB.dependencyResolutionRate).toBe(50);
  });

  it('computes avgResolutionTime from completed sessions', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T12:00:00Z'); // 12h later
    const sessions = [
      makeSession('s1', 't1', 'agentC', 'completed', start, end),
    ];
    const projectTickets = [makeTicket('t1', 'agentC', 'done', 'dep')];
    const result = buildDependencyResolutionMetrics(projectTickets, sessions);
    const agentC = result.find((a) => a.agentId === 'agentC')!;
    expect(agentC.avgResolutionTime).toBe(12);
  });

  it('uses 48h default when no completed sessions', () => {
    const projectTickets = [makeTicket('t1', 'agentD', 'in_progress', 'dep')];
    const result = buildDependencyResolutionMetrics(projectTickets, []);
    const agentD = result.find((a) => a.agentId === 'agentD')!;
    expect(agentD.avgResolutionTime).toBe(48);
  });

  it('sorts agents by resolutionScore descending', () => {
    const projectTickets = [
      makeTicket('t1', 'agentLow', 'in_progress', 'dep'),
      makeTicket('t2', 'agentHigh', 'done', 'dep'),
    ];
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T10:00:00Z');
    const sessions = [makeSession('s1', 't2', 'agentHigh', 'completed', start, end)];
    const result = buildDependencyResolutionMetrics(projectTickets, sessions);
    expect(result[0].resolutionScore).toBeGreaterThanOrEqual(result[result.length - 1].resolutionScore);
  });

  it('dependencyResolutionRate is 0 for agent with no blocked tickets', () => {
    const sessions = [makeSession('s1', 't1', 'agentE', 'completed', null, null)];
    const projectTickets = [makeTicket('t1', 'agentE', 'done', null)];
    const result = buildDependencyResolutionMetrics(projectTickets, sessions);
    const agentE = result.find((a) => a.agentId === 'agentE')!;
    expect(agentE.totalDependencies).toBe(0);
    expect(agentE.dependencyResolutionRate).toBe(0);
  });
});
