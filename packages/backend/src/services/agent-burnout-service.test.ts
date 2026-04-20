import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectBurnout } from './agent-burnout-service.js';

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
  staleDays: number,
  storyPoints: number | null = 1,
) {
  return {
    id: Math.random().toString(),
    title: `Ticket for ${assignedPersona}`,
    status,
    assignedPersona,
    updatedAt: daysAgo(staleDays),
    storyPoints,
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

describe('detectBurnout', () => {
  it('returns empty atRiskAgents when all agents have low load', async () => {
    // 3 agents each with 1 active ticket, 2 stale days — neither overloaded nor degrading
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 2),
      makeTicket('Beta', 'review', 2),
      makeTicket('Gamma', 'qa', 2),
    ]);
    const report = await detectBurnout('proj-1');
    expect(report.atRiskAgents).toHaveLength(0);
    expect(report.atRiskCount).toBe(0);
  });

  it('flags agent as overloaded when activeCount > avgActiveCount * 1.5 AND >= 3', async () => {
    // Alpha: 4 active, Beta: 1 active, Gamma: 1 active → avg = 2, threshold = 3
    // Alpha (4 > 3 AND 4 >= 3) → overloaded
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 1),
      makeTicket('Alpha', 'review', 1),
      makeTicket('Alpha', 'qa', 1),
      makeTicket('Alpha', 'in_progress', 1),
      makeTicket('Beta', 'in_progress', 1),
      makeTicket('Gamma', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const alpha = report.atRiskAgents.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.overloaded).toBe(true);
  });

  it('does NOT flag agent as overloaded when activeCount >= 3 but not > 1.5x avg', async () => {
    // Alpha: 3, Beta: 3, Gamma: 3 → avg = 3, threshold = 4.5 — none overloaded
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 1),
      makeTicket('Alpha', 'review', 1),
      makeTicket('Alpha', 'qa', 1),
      makeTicket('Beta', 'in_progress', 1),
      makeTicket('Beta', 'review', 1),
      makeTicket('Beta', 'qa', 1),
      makeTicket('Gamma', 'in_progress', 1),
      makeTicket('Gamma', 'review', 1),
      makeTicket('Gamma', 'qa', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const overloaded = report.atRiskAgents.filter((a) => a.overloaded);
    expect(overloaded).toHaveLength(0);
  });

  it('flags agent as degrading when avgStaleDays > 4 AND has 2+ active tickets', async () => {
    // Alpha: 2 active tickets, each 6 days stale → avgStaleDays = 6 > 4 AND count >= 2
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Alpha', 'review', 6),
      makeTicket('Beta', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const alpha = report.atRiskAgents.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.degrading).toBe(true);
  });

  it('does NOT flag agent as degrading with only 1 active ticket even if stale', async () => {
    // Alpha: 1 active ticket 10 days stale — not enough for degrading
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 10),
      makeTicket('Beta', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const alpha = report.atRiskAgents.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeUndefined();
  });

  it('classifies agent as critical when both overloaded AND degrading', async () => {
    // Alpha: 4 active stale tickets, others: 1 each → overloaded AND degrading
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Alpha', 'review', 6),
      makeTicket('Alpha', 'qa', 6),
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Beta', 'in_progress', 1),
      makeTicket('Gamma', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const alpha = report.atRiskAgents.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.riskLevel).toBe('critical');
    expect(alpha!.overloaded).toBe(true);
    expect(alpha!.degrading).toBe(true);
  });

  it('sorts output: critical first, then by activeCount descending within tier', async () => {
    // Alpha: critical (4 active, 6 stale), Beta: medium (2 active, 5 stale, not overloaded)
    // Gamma: high (3 active, 1 stale) — overloaded since avg < 2 → let's design carefully:
    // Alpha: 4 active 6 stale, Beta: 2 active 5 stale, Gamma: 1 active 1 stale
    // avg = (4+2+1)/3 = 2.33, threshold = 3.5
    // Alpha: 4 > 3.5 AND 4 >= 3 → overloaded; avgStaleDays=6 > 4 AND 2+ → degrading → critical
    // Beta: 2 not overloaded; avgStaleDays=5 > 4 AND 2+ active → degrading → medium (5 <= 7)
    // So: Alpha=critical, Beta=medium → Alpha first
    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Alpha', 'review', 6),
      makeTicket('Alpha', 'qa', 6),
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Beta', 'in_progress', 5),
      makeTicket('Beta', 'review', 5),
      makeTicket('Gamma', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    expect(report.atRiskAgents[0].agentName).toBe('Alpha');
    expect(report.atRiskAgents[0].riskLevel).toBe('critical');
  });

  it('falls back to heuristic recommendation on AI error', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API error')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    mockDbSelect([
      makeTicket('Alpha', 'in_progress', 6),
      makeTicket('Alpha', 'review', 6),
      makeTicket('Beta', 'in_progress', 1),
    ]);
    const report = await detectBurnout('proj-1');
    const alpha = report.atRiskAgents.find((a) => a.agentName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.recommendation).toBe("Consider redistributing active tickets to reduce this agent's load");
  });
});
