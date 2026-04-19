import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../db/connection.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []),
      }),
    }),
  },
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      },
    })),
  };
});

import { analyzeDependencies } from './blocker-dependency-service.js';

function makeTicket(overrides: Partial<{
  id: string; title: string; description: string; status: string; projectId: string;
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
    storyPoints: null,
    acceptanceCriteria: [],
    assignedPersona: null,
    assignedUserId: null,
    createdBy: 'user-1',
    source: 'human',
    parentTicketId: null,
    subtasks: [],
    createdAt: '2026-04-19T00:00:00Z',
    updatedAt: '2026-04-19T00:00:00Z',
  };
}

describe('analyzeDependencies', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__mockTickets = [];
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__mockTickets;
  });

  it('returns empty result when no tickets in project', async () => {
    const result = await analyzeDependencies('proj-1');
    expect(result.totalTickets).toBe(0);
    expect(result.edges).toEqual([]);
    expect(result.criticalBlockers).toEqual([]);
    expect(result.allBlockers).toEqual([]);
  });

  it('returns no edges with single ticket', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [makeTicket()];
    const result = await analyzeDependencies('proj-1');
    expect(result.totalTickets).toBe(1);
    expect(result.edges).toEqual([]);
  });

  it('detects edge when ticket B description mentions ticket A title (high confidence)', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-a', title: 'Implement the authentication middleware' }),
      makeTicket({ id: 'tik-b', title: 'Add login page', description: 'After the authentication middleware is done, add the login UI' }),
    ];
    const result = await analyzeDependencies('proj-1');
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
    const edge = result.edges.find(e => e.toTicketId === 'tik-a' && e.fromTicketId === 'tik-b');
    expect(edge).toBeDefined();
  });

  it('detects edge with "depends on" phrase', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-x', title: 'Create the database schema' }),
      makeTicket({ id: 'tik-y', title: 'Build API endpoints', description: 'This task depends on the database schema being ready first' }),
    ];
    const result = await analyzeDependencies('proj-1');
    const edge = result.edges.find(e => e.toTicketId === 'tik-x' && e.fromTicketId === 'tik-y');
    expect(edge).toBeDefined();
  });

  it('computes blockerScore=60 and riskLevel=high for ticket with 3 dependents', async () => {
    const baseTicket = makeTicket({ id: 'tik-base', title: 'Build the shared component library', status: 'review' });
    const dependents = [
      makeTicket({ id: 'tik-d1', title: 'Create dashboard UI', description: 'Use the shared component library for dashboard' }),
      makeTicket({ id: 'tik-d2', title: 'Create settings page', description: 'Build settings with the shared component library components' }),
      makeTicket({ id: 'tik-d3', title: 'Create profile view', description: 'Profile should use the shared component library' }),
    ];
    (globalThis as Record<string, unknown>).__mockTickets = [baseTicket, ...dependents];
    const result = await analyzeDependencies('proj-1');
    const blocker = result.allBlockers.find(b => b.ticketId === 'tik-base');
    expect(blocker).toBeDefined();
    expect(blocker!.blockerScore).toBe(60);
    expect(blocker!.riskLevel).toBe('high');
    expect(blocker!.blocksCount).toBe(3);
  });

  it('computes riskLevel=critical for ticket with 4+ dependents and backlog status', async () => {
    const baseTicket = makeTicket({ id: 'tik-core', title: 'Design the core data model', status: 'backlog' });
    const dependents = [
      makeTicket({ id: 'tik-e1', title: 'Build user API', description: 'API must follow the core data model specification' }),
      makeTicket({ id: 'tik-e2', title: 'Build ticket API', description: 'Follow the core data model for ticket structure' }),
      makeTicket({ id: 'tik-e3', title: 'Build project API', description: 'Use the core data model as base' }),
      makeTicket({ id: 'tik-e4', title: 'Build notification API', description: 'Notifications follow the core data model' }),
    ];
    (globalThis as Record<string, unknown>).__mockTickets = [baseTicket, ...dependents];
    const result = await analyzeDependencies('proj-1');
    const blocker = result.allBlockers.find(b => b.ticketId === 'tik-core');
    expect(blocker).toBeDefined();
    expect(blocker!.riskLevel).toBe('critical');
    expect(blocker!.blockerScore).toBeGreaterThanOrEqual(75);
  });

  it('returns heuristic edges when AI errors', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-m1', title: 'Setup CI pipeline' }),
      makeTicket({ id: 'tik-m2', title: 'Deploy to staging', description: 'Requires the Setup CI pipeline to be ready' }),
    ];
    const result = await analyzeDependencies('proj-1');
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
    expect(result.riskSummary).toBe('Unable to generate risk summary');
  });

  it('returns empty edges and allBlockers when no dependencies found', async () => {
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 'tik-s1', title: 'Unrelated task alpha', description: 'Just do some stuff' }),
      makeTicket({ id: 'tik-s2', title: 'Unrelated task beta', description: 'Different stuff entirely' }),
    ];
    const result = await analyzeDependencies('proj-1');
    expect(result.edges).toEqual([]);
    expect(result.allBlockers).toEqual([]);
    expect(result.dependencyCount).toBe(0);
    expect(result.riskSummary).toBe('No dependencies detected');
  });
});
