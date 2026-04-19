import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const m = {
    select: vi.fn(),
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

import { analyzeProjectHealth } from './project-health-service.js';

const NOW = Date.now();

function makeProject(overrides: Partial<{ id: string; name: string }> = {}) {
  return {
    id: overrides.id || 'proj-1',
    name: overrides.name || 'Test Project',
    repoUrl: null,
    localPath: null,
    defaultBranch: 'main',
    supportWorktrees: 1,
    githubTokenEncrypted: null,
    personaModelOverrides: {},
    transitionGates: {},
    maxRejectionCycles: 3,
    ownerId: 'user-1',
    createdAt: new Date(NOW - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(NOW),
  };
}

function makeEpic(overrides: Partial<{ id: string; featureId: string; title: string }> = {}) {
  return {
    id: overrides.id || 'epic-1',
    featureId: overrides.featureId || 'feat-1',
    title: overrides.title || 'Test Epic',
    description: null,
    sortOrder: 0,
    color: '#3b82f6',
    createdAt: new Date(NOW - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(NOW),
  };
}

function makeTicket(overrides: Partial<{
  id: string;
  epicId: string | null;
  title: string;
  description: string;
  status: string;
  storyPoints: number | null;
  acceptanceCriteria: unknown[];
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id || 'tik-1',
    epicId: overrides.epicId !== undefined ? overrides.epicId : 'epic-1',
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

function setupMocks(projectRows: unknown[], featureRows: unknown[], epicRows: unknown[], ticketRows: unknown[]) {
  let callCount = 0;
  mockDb.select.mockImplementation(() => ({
    from: vi.fn(() => ({
      where: () => {
        callCount++;
        if (callCount === 1) return Promise.resolve(projectRows);   // projects query
        if (callCount === 2) return Promise.resolve(featureRows);   // features query
        if (callCount === 3 && epicRows.length === 0) return Promise.resolve(epicRows); // epics (0 features case won't call)
        if (callCount === 3) return Promise.resolve(epicRows);      // epics query (first feature)
        return Promise.resolve(ticketRows);                          // tickets query
      },
    })),
  }));
}

describe('analyzeProjectHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-existent project', async () => {
    setupMocks([], [], [], []);
    const result = await analyzeProjectHealth('proj-nope');
    expect(result).toBeNull();
  });

  it('empty project (no tickets/epics) -> healthScore=0, riskLevel=critical', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);  // projects
          if (callCount === 2) return Promise.resolve([]);               // features (empty)
          return Promise.resolve([]);                                     // tickets
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    expect(result).not.toBeNull();
    expect(result!.healthScore).toBe(0);
    expect(result!.riskLevel).toBe('critical');
  });

  it('all done tickets -> healthScore>=85, riskLevel=healthy', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);  // projects
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]); // features
          if (callCount === 3) return Promise.resolve([makeEpic({ id: 'epic-1' })]); // epics
          // tickets query (callCount === 4)
          return Promise.resolve([
            makeTicket({ id: 't1', epicId: 'epic-1', status: 'done', storyPoints: 5, description: 'A long enough description with AC: acceptance criteria here and - [ ] checkbox', createdAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) }),
            makeTicket({ id: 't2', epicId: 'epic-1', status: 'done', storyPoints: 3, description: 'Another well-defined ticket with AC: acceptance criteria listed here and more', createdAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) }),
          ]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    expect(result!.healthScore).toBeGreaterThanOrEqual(85);
    expect(result!.riskLevel).toBe('healthy');
  });

  it('low-quality tickets (no desc/storyPoints) -> quality dimension < 50', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]);
          if (callCount === 3) return Promise.resolve([makeEpic()]);
          return Promise.resolve([
            makeTicket({ id: 't1', status: 'backlog', description: '', storyPoints: null }),
            makeTicket({ id: 't2', status: 'backlog', description: 'Short', storyPoints: null }),
            makeTicket({ id: 't3', status: 'backlog', description: '', storyPoints: null }),
            makeTicket({ id: 't4', status: 'backlog', description: 'Also short', storyPoints: null }),
          ]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    expect(result!.dimensions.quality).toBeLessThan(50);
  });

  it('multiple old idea-status tickets -> risk dimension > 50', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]);
          if (callCount === 3) return Promise.resolve([
            // 2 epics with no tickets (will add risk)
            makeEpic({ id: 'epic-1', title: 'Empty Epic 1' }),
            makeEpic({ id: 'epic-2', title: 'Empty Epic 2' }),
          ]);
          // tickets: old idea-status tickets (NOT linked to epics so epics have 0 tickets)
          return Promise.resolve([
            makeTicket({ id: 't1', epicId: null, status: 'idea', createdAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) }),
            makeTicket({ id: 't2', epicId: null, status: 'idea', createdAt: new Date(NOW - 15 * 24 * 60 * 60 * 1000) }),
            makeTicket({ id: 't3', epicId: null, status: 'idea', createdAt: new Date(NOW - 20 * 24 * 60 * 60 * 1000) }),
          ]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    // 2/2 epics with 0 tickets => epicRisk = 1.0 * 60 = 60
    // 3/3 old idea tickets => ideaRisk = 1.0 * 40 = 40
    // total risk = min(100, 60 + 40) = 100, capped at 100 => 100
    expect(result!.dimensions.risk).toBeGreaterThan(50);
  });

  it('tickets with blocked in description -> topBlockers populated (max 3)', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]);
          if (callCount === 3) return Promise.resolve([]);
          return Promise.resolve([
            makeTicket({ id: 't1', title: 'Blocker A', description: 'This ticket is blocked by payment service' }),
            makeTicket({ id: 't2', title: 'Blocker B', description: 'Currently blocked waiting for API' }),
            makeTicket({ id: 't3', title: 'Blocker C', description: 'blocked due to missing credentials' }),
            makeTicket({ id: 't4', title: 'Normal D', description: 'Regular ticket with no issues' }),
          ]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    expect(result!.topBlockers.length).toBeGreaterThan(0);
    expect(result!.topBlockers.length).toBeLessThanOrEqual(3);
    expect(result!.topBlockers).toContain('Blocker A');
  });

  it('epic with 2 done / 4 total -> completionRate=50', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]);
          if (callCount === 3) return Promise.resolve([makeEpic({ id: 'epic-1' })]);
          return Promise.resolve([
            makeTicket({ id: 't1', epicId: 'epic-1', status: 'done' }),
            makeTicket({ id: 't2', epicId: 'epic-1', status: 'done' }),
            makeTicket({ id: 't3', epicId: 'epic-1', status: 'backlog' }),
            makeTicket({ id: 't4', epicId: 'epic-1', status: 'backlog' }),
          ]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    expect(result!.epicSummaries.length).toBe(1);
    expect(result!.epicSummaries[0].completionRate).toBe(50);
    expect(result!.epicSummaries[0].status).toBe('in_progress');
  });

  it('AI error -> returns heuristic result, executiveSummary contains heuristic', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve([makeProject()]);
          if (callCount === 2) return Promise.resolve([{ id: 'feat-1' }]);
          if (callCount === 3) return Promise.resolve([makeEpic()]);
          return Promise.resolve([makeTicket({ id: 't1', status: 'backlog' })]);
        },
      })),
    }));

    const result = await analyzeProjectHealth('proj-1');
    // AI mock always throws, so we should get heuristic
    expect(result).not.toBeNull();
    expect(result!.executiveSummary.toLowerCase()).toContain('heuristic');
  });
});
