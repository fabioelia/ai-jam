import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../db/connection.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []),
      }),
    }),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
    },
  })),
}));

import { prioritizeTickets } from './ticket-prioritizer-service.js';

function makeTicket(overrides: Partial<{
  id: string; title: string; description: string; status: string; projectId: string;
  storyPoints: number | null; acceptanceCriteria: unknown[]; createdAt: Date;
}> = {}) {
  return {
    id: overrides.id || 'tik-001',
    title: overrides.title || 'Test Ticket',
    description: overrides.description ?? '',
    status: overrides.status || 'backlog',
    projectId: overrides.projectId || 'proj-1',
    epicId: null,
    featureId: 'feat-1',
    priority: 'medium',
    sortOrder: 0,
    storyPoints: overrides.storyPoints ?? null,
    acceptanceCriteria: overrides.acceptanceCriteria ?? [],
    assignedPersona: null,
    assignedUserId: null,
    createdBy: 'user-1',
    source: 'human',
    parentTicketId: null,
    subtasks: [],
    createdAt: overrides.createdAt ?? new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
  };
}

describe('prioritizeTickets', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__mockTickets = [];
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__mockTickets;
  });

  it('returns empty result when no tickets in project', async () => {
    const result = await prioritizeTickets('proj-1');
    expect(result.totalTickets).toBe(0);
    expect(result.rankedTickets).toEqual([]);
  });

  it('single ticket gets rank 1 and priorityScore > 0', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [makeTicket()];
    const result = await prioritizeTickets('proj-1');
    expect(result.totalTickets).toBe(1);
    expect(result.rankedTickets[0].priorityRank).toBe(1);
    expect(result.rankedTickets[0].priorityScore).toBeGreaterThan(0);
  });

  it('high story points ticket ranks above low story points (impact)', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-low', title: 'Small fix', storyPoints: 1 }),
      makeTicket({ id: 'tik-high', title: 'Big feature', storyPoints: 13 }),
    ];
    const result = await prioritizeTickets('proj-1');
    const lowRank = result.rankedTickets.find(t => t.ticketId === 'tik-low')!.priorityRank;
    const highRank = result.rankedTickets.find(t => t.ticketId === 'tik-high')!.priorityRank;
    expect(highRank).toBeLessThan(lowRank);
  });

  it('old ticket gets urgency boost vs new ticket', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-new', title: 'New ticket', createdAt: yesterday }),
      makeTicket({ id: 'tik-old', title: 'Old ticket', createdAt: thirtyDaysAgo }),
    ];
    const result = await prioritizeTickets('proj-1');
    const newUrgency = result.rankedTickets.find(t => t.ticketId === 'tik-new')!.dimensions.urgency;
    const oldUrgency = result.rankedTickets.find(t => t.ticketId === 'tik-old')!.dimensions.urgency;
    expect(oldUrgency).toBeGreaterThan(newUrgency);
  });

  it('ticket that many others depend on ranks higher (dependency)', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-core', title: 'Build the authentication system', storyPoints: 8 }),
      makeTicket({ id: 'tik-a', title: 'Add login page', description: 'Use the authentication system for login', storyPoints: 5 }),
      makeTicket({ id: 'tik-b', title: 'Add logout button', description: 'Call the authentication system logout endpoint', storyPoints: 3 }),
      makeTicket({ id: 'tik-c', title: 'Admin panel', description: 'Admin uses the authentication system for access control', storyPoints: 8 }),
    ];
    const result = await prioritizeTickets('proj-1');
    const coreDep = result.rankedTickets.find(t => t.ticketId === 'tik-core')!.dimensions.dependency;
    const aDep = result.rankedTickets.find(t => t.ticketId === 'tik-a')!.dimensions.dependency;
    expect(coreDep).toBeGreaterThan(aDep);
  });

  it('ready ticket (long desc + ACs + non-idea) beats not-ready', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-ready', description: 'A detailed description of the feature with full acceptance criteria', acceptanceCriteria: [{ title: 'Should work' }], storyPoints: 5 }),
      makeTicket({ id: 'tik-notready', description: 'Short', status: 'idea', storyPoints: 5 }),
    ];
    const result = await prioritizeTickets('proj-1');
    const readyReadiness = result.rankedTickets.find(t => t.ticketId === 'tik-ready')!.dimensions.readiness;
    const notReadyReadiness = result.rankedTickets.find(t => t.ticketId === 'tik-notready')!.dimensions.readiness;
    expect(readyReadiness).toBeGreaterThan(notReadyReadiness);
  });

  it('returns heuristic ranking when AI errors with rationale containing heuristic', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-1', title: 'Task one', storyPoints: 5 }),
      makeTicket({ id: 'tik-2', title: 'Task two', storyPoints: 8 }),
    ];
    const result = await prioritizeTickets('proj-1');
    expect(result.rankedTickets.length).toBeGreaterThan(0);
    expect(result.rationaleSummary.toLowerCase()).toContain('heuristic');
  });

  it('excludes done and in_progress tickets', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-done', status: 'done' }),
      makeTicket({ id: 'tik-progress', status: 'in_progress' }),
      makeTicket({ id: 'tik-backlog', status: 'backlog' }),
    ];
    const result = await prioritizeTickets('proj-1');
    expect(result.rankedTickets.find(t => t.ticketId === 'tik-done')).toBeUndefined();
    expect(result.rankedTickets.find(t => t.ticketId === 'tik-progress')).toBeUndefined();
    expect(result.rankedTickets.find(t => t.ticketId === 'tik-backlog')).toBeDefined();
  });
});
