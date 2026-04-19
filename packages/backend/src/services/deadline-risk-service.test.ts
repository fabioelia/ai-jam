import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and Anthropic before importing the service
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: '{"narrative": "AI narrative text.", "recommendations": ["Rec 1", "Rec 2"]}',
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
import { analyzeDeadlineRisk } from './deadline-risk-service.js';

// Helper to build a mock project
function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Test Project',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    ...overrides,
  };
}

// Helper to build mock tickets
function makeTickets(done: number, remaining: number) {
  const tickets: { id: string; status: string; projectId: string }[] = [];
  for (let i = 0; i < done; i++) {
    tickets.push({ id: `done-${i}`, status: 'done', projectId: 'proj-1' });
  }
  for (let i = 0; i < remaining; i++) {
    tickets.push({ id: `rem-${i}`, status: 'in_progress', projectId: 'proj-1' });
  }
  return tickets;
}

// Helper to set up the DB mock chain: select().from().where() => rows
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

describe('analyzeDeadlineRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Project with no tickets → remainingTickets=0, willMeetDeadline=true, riskLevel='ahead'
  it('project with no tickets returns willMeetDeadline=true and riskLevel=ahead', async () => {
    mockDB([makeProject()], []);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', futureDate);
    expect(result).not.toBeNull();
    expect(result!.remainingTickets).toBe(0);
    expect(result!.willMeetDeadline).toBe(true);
    expect(result!.riskLevel).toBe('ahead');
  });

  // Test 2: All done tickets → willMeetDeadline=true, riskLevel='ahead'
  it('all done tickets returns willMeetDeadline=true and riskLevel=ahead', async () => {
    mockDB([makeProject()], makeTickets(5, 0));
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', futureDate);
    expect(result).not.toBeNull();
    expect(result!.remainingTickets).toBe(0);
    expect(result!.willMeetDeadline).toBe(true);
    expect(result!.riskLevel).toBe('ahead');
  });

  // Test 3: High remaining + few days → riskLevel='critical', willMeetDeadline=false
  it('high remaining tickets with few days returns critical risk', async () => {
    // Project created 5 days ago, 2 done, 50 remaining, deadline in 3 days
    mockDB(
      [makeProject({ createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) })],
      makeTickets(2, 50),
    );
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', soonDate);
    expect(result).not.toBeNull();
    expect(result!.riskLevel).toBe('critical');
    expect(result!.willMeetDeadline).toBe(false);
  });

  // Test 4: velocityPerDay > requiredVelocity → riskLevel='ahead' or 'on_track'
  it('velocity exceeds required returns ahead or on_track', async () => {
    // 8 done over 10 days = 0.8/day velocity; 2 remaining, 10 days left = 0.2/day required
    mockDB(
      [makeProject({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) })],
      makeTickets(8, 2),
    );
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', futureDate);
    expect(result).not.toBeNull();
    expect(['ahead', 'on_track']).toContain(result!.riskLevel);
    expect(result!.velocityPerDay).toBeGreaterThan(result!.requiredVelocity);
  });

  // Test 5: Past deadline date → riskLevel='critical'
  it('past deadline date returns critical risk', async () => {
    mockDB([makeProject()], makeTickets(2, 5));
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', pastDate);
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBeLessThan(0);
    expect(result!.riskLevel).toBe('critical');
  });

  // Test 6: velocityGap between -0.5 and 0.5 → riskLevel='on_track'
  it('velocity gap near zero returns on_track', async () => {
    // 5 done over 10 days = 0.5/day; 5 remaining, 10 days = 0.5/day required → gap = 0
    mockDB(
      [makeProject({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) })],
      makeTickets(5, 5),
    );
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', futureDate);
    expect(result).not.toBeNull();
    expect(result!.riskLevel).toBe('on_track');
    expect(result!.velocityGap).toBeGreaterThanOrEqual(-0.5);
    expect(result!.velocityGap).toBeLessThanOrEqual(0.5);
  });

  // Test 7: AI error → heuristic result, narrative contains 'heuristic'
  it('AI error falls back to heuristic with narrative containing heuristic', async () => {
    // Make the AI call reject for this test
    mockMessagesCreate.mockRejectedValueOnce(new Error('AI service down'));

    mockDB([makeProject()], makeTickets(2, 10));
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('proj-1', futureDate);
    expect(result).not.toBeNull();
    expect(result!.narrative).toContain('heuristic');
    expect(result!.recommendations.length).toBeGreaterThan(0);
  });

  // Test 8: Non-existent project → service returns null
  it('non-existent project returns null', async () => {
    mockDB([], []);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await analyzeDeadlineRisk('nonexistent-id', futureDate);
    expect(result).toBeNull();
  });
});
