import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: '{"narrative": "AI narrative text.", "topConcern": "None"}',
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: {
        create: mockMessagesCreate,
      },
    };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';
import { checkReleaseReadiness } from './release-readiness-service.js';

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Test Project',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: `ticket-${Math.random()}`,
    status: 'done',
    priority: 'medium',
    description: 'A description',
    acceptanceCriteria: ['AC1'],
    storyPoints: 3,
    dueDate: null,
    projectId: 'proj-1',
    featureId: 'feat-1',
    ...overrides,
  };
}

function mockDB(projectRows: unknown[], ticketRows: unknown[]) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    from: () => ({
      where: () => {
        callCount++;
        if (callCount === 1) return Promise.resolve(projectRows);
        return Promise.resolve(ticketRows);
      },
    }),
  }));
}

describe('checkReleaseReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('all tickets done with no blockers returns verdict=ready and all checks pass', async () => {
    const tickets = [
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'review' }),
      makeTicket({ status: 'done' }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe('ready');
    expect(result!.checks.every((c) => c.passed)).toBe(true);
    expect(result!.doneTickets).toBe(3);
    expect(result!.completionPercent).toBe(100);
  });

  it('tickets still in_progress causes AllDone to fail and verdict=not_ready', async () => {
    const tickets = [
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'in_progress' }),
      makeTicket({ status: 'in_progress' }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe('not_ready');
    const allDone = result!.checks.find((c) => c.name === 'AllDone');
    expect(allDone!.passed).toBe(false);
    expect(allDone!.detail).toContain('2 tickets still in progress');
  });

  it('open critical priority ticket causes NoCriticalBlockers to fail and verdict=not_ready', async () => {
    const tickets = [
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'in_progress', priority: 'critical' }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe('not_ready');
    const noCritical = result!.checks.find((c) => c.name === 'NoCriticalBlockers');
    expect(noCritical!.passed).toBe(false);
    expect(noCritical!.detail).toContain('1 critical blockers open');
  });

  it('all done except one critical blocker in_progress — NoCriticalBlockers fails even when other tickets done', async () => {
    const tickets = [
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'in_progress', priority: 'critical' }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    const noCritical = result!.checks.find((c) => c.name === 'NoCriticalBlockers');
    expect(noCritical!.passed).toBe(false);
    expect(result!.verdict).toBe('not_ready');
  });

  it('low quality tickets cause QualityThreshold to fail and verdict=conditional', async () => {
    // Tickets with no description, no AC, no storyPoints = 0% quality each
    const tickets = [
      makeTicket({ status: 'done', description: '', acceptanceCriteria: [], storyPoints: null }),
      makeTicket({ status: 'done', description: '', acceptanceCriteria: [], storyPoints: null }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    const quality = result!.checks.find((c) => c.name === 'QualityThreshold');
    expect(quality!.passed).toBe(false);
    expect(result!.verdict).toBe('conditional');
  });

  it('overdue ticket causes NoOverdueTickets to fail', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tickets = [
      makeTicket({ status: 'done' }),
      makeTicket({ status: 'in_progress', dueDate: pastDate }),
    ];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    const overdue = result!.checks.find((c) => c.name === 'NoOverdueTickets');
    expect(overdue!.passed).toBe(false);
    expect(overdue!.detail).toContain('1 overdue tickets');
  });

  it('AI error falls back to heuristic narrative containing heuristic', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('AI service down'));
    const tickets = [makeTicket({ status: 'in_progress' })];
    mockDB([makeProject()], tickets);
    const result = await checkReleaseReadiness('proj-1');
    expect(result).not.toBeNull();
    expect(result!.narrative).toContain('heuristic');
    expect(result!.topConcern).toBe('AllDone');
  });

  it('non-existent project returns null', async () => {
    mockDB([], []);
    const result = await checkReleaseReadiness('nonexistent-id');
    expect(result).toBeNull();
  });
});
