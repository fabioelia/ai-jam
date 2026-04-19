import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const m = {
    select: vi.fn(() => ({
      from: vi.fn((tableRef: { _: unknown }) => {
        // Distinguish epics vs tickets by checking the table symbol
        // The epics table has a different symbol than the tickets table
        // We use globalThis flags to control which data to return
        const returnEpics = (globalThis as Record<string, unknown>).__mockReturnEpics;
        return {
          where: () => {
            if (returnEpics) {
              return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
            }
            return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
          },
        };
      }),
    })),
  };
  return { mockDb: m };
});

vi.mock('../db/connection.js', () => ({ db: mockDb }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
    },
  })),
}));

import { analyzeEpicHealth } from './epic-health-service.js';

const NOW = Date.now();

function makeEpic(overrides: Partial<{ id: string; title: string; createdAt: Date }> = {}) {
  return {
    id: overrides.id || 'epic-1',
    featureId: 'feat-1',
    title: overrides.title || 'Test Epic',
    description: null,
    sortOrder: 0,
    color: '#3b82f6',
    createdAt: overrides.createdAt ?? new Date(NOW - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(NOW),
  };
}

function makeTicket(overrides: Partial<{ id: string; epicId: string; title: string; description: string; status: string; storyPoints: number | null; acceptanceCriteria: unknown[]; createdAt: Date }> = {}) {
  return {
    id: overrides.id || 'tik-1',
    epicId: overrides.epicId ?? 'epic-1',
    featureId: 'feat-1',
    projectId: 'proj-1',
    title: overrides.title || 'Test Ticket',
    description: overrides.description ?? '',
    status: overrides.status || 'backlog',
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
    createdAt: overrides.createdAt ?? new Date(NOW - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(NOW),
  };
}

describe('analyzeEpicHealth', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__mockEpics = [];
    (globalThis as Record<string, unknown>).__mockTickets = [];
    (globalThis as Record<string, unknown>).__mockReturnEpics = false;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__mockEpics;
    delete (globalThis as Record<string, unknown>).__mockTickets;
    delete (globalThis as Record<string, unknown>).__mockReturnEpics;
  });

  it('returns null for non-existent epic', async () => {
    (globalThis as Record<string, unknown>).__mockEpics = [];
    // First call (epics query) returns empty, so analyzeEpicHealth returns null
    (globalThis as Record<string, unknown>).__mockReturnEpics = true;
    const result = await analyzeEpicHealth('epic-nope');
    expect(result).toBeNull();
  });

  it('returns critical with healthScore=0 when no tickets', async () => {
    // The service does: db.select().from(epics).where() then db.select().from(tickets).where()
    // We need the epics query to return an epic, then the tickets query to return []
    // With our mock, the first from().where() call should return epics, the second tickets
    // Let's use a counter approach instead
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            // First call: epics query
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          // Second call: tickets query
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic()];
    (globalThis as Record<string, unknown>).__mockTickets = [];

    const result = await analyzeEpicHealth('epic-1');
    expect(result).not.toBeNull();
    expect(result!.healthScore).toBe(0);
    expect(result!.riskLevel).toBe('critical');
  });

  it('all done tickets -> healthScore>=85 healthy', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    const oldEpicDate = new Date(NOW - 30 * 24 * 60 * 60 * 1000);
    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic({ createdAt: oldEpicDate })];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', status: 'done', storyPoints: 5, description: 'A well-defined ticket with sufficient description text for readiness criteria', acceptanceCriteria: [{ title: 'AC1' }] }),
      makeTicket({ id: 't2', status: 'done', storyPoints: 3, description: 'Another well-defined ticket with sufficient description text for readiness criteria', acceptanceCriteria: [{ title: 'AC2' }] }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.healthScore).toBeGreaterThanOrEqual(85);
    expect(result!.riskLevel).toBe('healthy');
  });

  it('>50% tickets without description/ACs -> readiness < 50', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic()];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', status: 'backlog', description: '', acceptanceCriteria: [] }),
      makeTicket({ id: 't2', status: 'backlog', description: 'Short', acceptanceCriteria: [] }),
      makeTicket({ id: 't3', status: 'backlog', description: '', acceptanceCriteria: [] }),
      makeTicket({ id: 't4', status: 'backlog', storyPoints: 1, description: 'A long enough description for readiness', acceptanceCriteria: [{ title: 'AC' }] }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.dimensions.readiness).toBeLessThan(50);
  });

  it('tickets added >3 days after epic created -> scopeRisk > 50', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic({ createdAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) })];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', createdAt: new Date(NOW - 1 * 24 * 60 * 60 * 1000) }),
      makeTicket({ id: 't2', createdAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000) }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.dimensions.scopeRisk).toBeGreaterThan(50);
  });

  it('no in_progress/review/done -> velocity=0', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic()];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', status: 'backlog' }),
      makeTicket({ id: 't2', status: 'backlog' }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.dimensions.velocity).toBe(0);
  });

  it('AI error -> narrative contains heuristic', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic()];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', status: 'backlog', title: 'Some work' }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.narrative.toLowerCase()).toContain('heuristic');
  });

  it('mixed statuses -> correct ticketBreakdown counts', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve((globalThis as Record<string, unknown>).__mockEpics || []);
          }
          return Promise.resolve((globalThis as Record<string, unknown>).__mockTickets || []);
        },
      })),
    }));

    (globalThis as Record<string, unknown>).__mockEpics = [makeEpic()];
    (globalThis as Record<string, unknown>).__mockTickets = [
      makeTicket({ id: 't1', status: 'backlog' }),
      makeTicket({ id: 't2', status: 'backlog' }),
      makeTicket({ id: 't3', status: 'in_progress' }),
      makeTicket({ id: 't4', status: 'review' }),
      makeTicket({ id: 't5', status: 'done' }),
    ];
    const result = await analyzeEpicHealth('epic-1');
    expect(result!.ticketBreakdown).toEqual({ idea: 0, backlog: 2, inProgress: 1, review: 1, done: 1 });
    expect(result!.totalTickets).toBe(5);
  });
});
