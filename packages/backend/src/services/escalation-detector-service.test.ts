import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the DB module before importing the service
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    })),
  };
});

import { db } from '../db/connection.js';
import { detectEscalations } from './escalation-detector-service.js';

// Helper to build a mock db select chain
function mockSelect(rows: object[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// Helper to build a ticket row
function makeTicket(overrides: {
  id?: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  storyPoints?: number | null;
  assignedPersona?: string | null;
  updatedAt?: Date;
}) {
  return {
    id: overrides.id ?? 'ticket-1',
    title: overrides.title ?? 'Test Ticket',
    description: overrides.description ?? null,
    priority: overrides.priority ?? 'medium',
    status: overrides.status ?? 'backlog',
    storyPoints: overrides.storyPoints ?? null,
    assignedPersona: overrides.assignedPersona ?? null,
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

// Helper to create a date N days ago
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

describe('detectEscalations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Returns empty staleTickets when all tickets updated recently', async () => {
    mockSelect([
      makeTicket({ status: 'in_progress', updatedAt: daysAgo(1) }),
      makeTicket({ id: 'ticket-2', status: 'backlog', updatedAt: daysAgo(2) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(0);
    expect(report.totalStale).toBe(0);
  });

  it('2. Marks in_progress ticket as stale when staleDays > 3', async () => {
    mockSelect([
      makeTicket({ status: 'in_progress', updatedAt: daysAgo(4) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(1);
    expect(report.staleTickets[0].status).toBe('in_progress');
    expect(report.staleTickets[0].staleDays).toBeGreaterThan(3);
  });

  it('3. Marks review ticket as stale when staleDays > 2', async () => {
    mockSelect([
      makeTicket({ status: 'review', updatedAt: daysAgo(3) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(1);
    expect(report.staleTickets[0].status).toBe('review');
  });

  it('4. Does NOT mark backlog ticket as stale when staleDays = 5 (below 7-day threshold)', async () => {
    mockSelect([
      makeTicket({ status: 'backlog', updatedAt: daysAgo(5) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(0);
  });

  it('5. Marks backlog ticket as stale when staleDays = 8', async () => {
    mockSelect([
      makeTicket({ status: 'backlog', updatedAt: daysAgo(8) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(1);
    expect(report.staleTickets[0].status).toBe('backlog');
    expect(report.staleTickets[0].staleDays).toBeGreaterThanOrEqual(8);
  });

  it('6. Classifies critical priority stale ticket as riskLevel="critical"', async () => {
    mockSelect([
      makeTicket({ status: 'in_progress', priority: 'critical', updatedAt: daysAgo(5) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(1);
    expect(report.staleTickets[0].riskLevel).toBe('critical');
    expect(report.criticalCount).toBe(1);
  });

  it('7. Sorts output: critical risk first', async () => {
    mockSelect([
      makeTicket({ id: 'medium-ticket', status: 'backlog', priority: 'low', updatedAt: daysAgo(10) }),
      makeTicket({ id: 'critical-ticket', status: 'in_progress', priority: 'critical', updatedAt: daysAgo(5) }),
      makeTicket({ id: 'high-ticket', status: 'review', priority: 'high', updatedAt: daysAgo(4) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets.length).toBeGreaterThanOrEqual(2);
    expect(report.staleTickets[0].riskLevel).toBe('critical');

    // critical must appear before high and medium
    const riskLevels = report.staleTickets.map((t) => t.riskLevel);
    const firstNonCritical = riskLevels.findIndex((r) => r !== 'critical');
    if (firstNonCritical !== -1) {
      expect(['high', 'medium']).toContain(riskLevels[firstNonCritical]);
    }
  });

  it('8. Falls back to heuristic recommendation on AI error', async () => {
    // AI is already mocked to throw — just verify fallback text is used
    mockSelect([
      makeTicket({ status: 'in_progress', updatedAt: daysAgo(5) }),
    ]);

    const report = await detectEscalations('project-1');
    expect(report.staleTickets).toHaveLength(1);
    expect(report.staleTickets[0].recommendation).toBe(
      'Consider reassigning or breaking this ticket into smaller sub-tasks',
    );
  });
});
