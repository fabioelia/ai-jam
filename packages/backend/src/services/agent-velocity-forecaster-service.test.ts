import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forecastVelocity } from './agent-velocity-forecaster-service.js';

// Mock DB and Anthropic
vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

const NOW = Date.now();

function daysAgo(days: number): Date {
  return new Date(NOW - days * 86400000);
}

function makeTicket(
  assignedPersona: string | null,
  status: string,
  updatedDaysAgo: number,
  storyPoints: number | null = 3,
) {
  return {
    id: Math.random().toString(),
    assignedPersona,
    status,
    storyPoints,
    updatedAt: daysAgo(updatedDaysAgo),
  };
}

function mockDbSelect(tickets: ReturnType<typeof makeTicket>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(tickets),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('forecastVelocity', () => {
  it('returns empty agentVelocities when no done tickets', async () => {
    mockDbSelect([]);
    const report = await forecastVelocity('proj-1');
    expect(report.agentVelocities).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
    expect(report.totalForecastPoints).toBe(0);
    expect(report.topAgent).toBeNull();
    expect(report.atRiskAgents).toHaveLength(0);
  });

  it('computes recentPoints correctly with null storyPoints defaulting to 2', async () => {
    // Alpha: 2 done tickets in last 14 days — one with storyPoints=null (→2), one with storyPoints=5
    // recentPoints = 2 + 5 = 7
    mockDbSelect([
      makeTicket('Alpha', 'done', 3, null),   // null → 2
      makeTicket('Alpha', 'done', 7, 5),       // 5
    ]);
    const report = await forecastVelocity('proj-1');
    const alpha = report.agentVelocities.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.recentPoints).toBe(7);
    expect(alpha!.recentCount).toBe(2);
  });

  it('trend is "up" when recentPoints >= priorPoints * 1.1', async () => {
    // Alpha: priorPoints=10 (15-28 days ago), recentPoints=11 (0-14 days ago) → 11 >= 11 → up
    mockDbSelect([
      makeTicket('Alpha', 'done', 20, 10),  // prior window
      makeTicket('Alpha', 'done', 5, 11),   // recent window
    ]);
    const report = await forecastVelocity('proj-1');
    const alpha = report.agentVelocities.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.trend).toBe('up');
  });

  it('trend is "down" when recentPoints <= priorPoints * 0.9', async () => {
    // Alpha: priorPoints=10, recentPoints=9 → 9 <= 9 → down
    mockDbSelect([
      makeTicket('Alpha', 'done', 20, 10),  // prior window
      makeTicket('Alpha', 'done', 5, 9),    // recent window
    ]);
    const report = await forecastVelocity('proj-1');
    const alpha = report.agentVelocities.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.trend).toBe('down');
  });

  it('trend is "stable" when within ±10%', async () => {
    // Alpha: priorPoints=10, recentPoints=10 → exactly equal → stable
    mockDbSelect([
      makeTicket('Alpha', 'done', 20, 10),  // prior window
      makeTicket('Alpha', 'done', 5, 10),   // recent window
    ]);
    const report = await forecastVelocity('proj-1');
    const alpha = report.agentVelocities.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.trend).toBe('stable');
  });

  it('trend is "new" when priorPoints is 0', async () => {
    // Beta: only has recent tickets, no prior-window tickets → priorPoints=0 → new
    mockDbSelect([
      makeTicket('Beta', 'done', 5, 8),   // recent window only
    ]);
    const report = await forecastVelocity('proj-1');
    const beta = report.agentVelocities.find((a) => a.agentName === 'Beta');
    expect(beta).toBeDefined();
    expect(beta!.trend).toBe('new');
    expect(beta!.priorPoints).toBe(0);
  });

  it('sorts agentVelocities by forecastPoints descending', async () => {
    // Alpha: 3 pts recent, Beta: 10 pts recent, Gamma: 6 pts recent
    // expected order: Beta (10), Gamma (6), Alpha (3)
    mockDbSelect([
      makeTicket('Alpha', 'done', 5, 3),
      makeTicket('Beta', 'done', 5, 10),
      makeTicket('Gamma', 'done', 5, 6),
    ]);
    const report = await forecastVelocity('proj-1');
    const names = report.agentVelocities.map((a) => a.agentName);
    expect(names[0]).toBe('Beta');
    expect(names[1]).toBe('Gamma');
    expect(names[2]).toBe('Alpha');
    // Verify each is >= next
    for (let i = 0; i < report.agentVelocities.length - 1; i++) {
      expect(report.agentVelocities[i].forecastPoints).toBeGreaterThanOrEqual(
        report.agentVelocities[i + 1].forecastPoints,
      );
    }
  });

  it('uses fallback recommendation when AI errors out', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI error')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    // Alpha: prior=10, recent=9 → down → fallback = 'Review workload and blockers'
    mockDbSelect([
      makeTicket('Alpha', 'done', 20, 10),  // prior window
      makeTicket('Alpha', 'done', 5, 9),    // recent window
    ]);
    const report = await forecastVelocity('proj-1');
    const alpha = report.agentVelocities.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.recommendation).toBe('Review workload and blockers');
  });
});
