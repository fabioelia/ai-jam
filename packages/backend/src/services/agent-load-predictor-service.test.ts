import { describe, it, expect, vi, beforeEach } from 'vitest';
import { predictLoad } from './agent-load-predictor-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI load insight.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

function makeTicket(assignedPersona: string | null, status: string) {
  return {
    id: `ticket-${Math.random().toString(36).slice(2)}`,
    status,
    assignedPersona,
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

describe('predictLoad', () => {
  // AC1: returns 200 with LoadPredictionReport shape
  it('returns a valid LoadPredictionReport shape', async () => {
    mockDbSelect([
      makeTicket('Alice', 'in_progress'),
      makeTicket('Alice', 'backlog'),
    ]);
    const report = await predictLoad('proj-1');
    expect(report).toMatchObject({
      projectId: 'proj-1',
      forecastWindow: expect.any(String),
      totalTicketsPipeline: expect.any(Number),
      overloadedAgents: expect.any(Number),
      agentForecasts: expect.any(Array),
      bottleneckWarnings: expect.any(Array),
      aiInsight: expect.any(String),
      analyzedAt: expect.any(String),
    });
  });

  // AC2: predictedLoad = currentLoad + round(backlogCount × 0.3)
  it('computes predictedLoad correctly: currentLoad + round(backlogCount × 0.3)', async () => {
    // Alice: 2 in_progress, 3 backlog → predictedLoad = 2 + round(3 × 0.3) = 2 + 1 = 3
    mockDbSelect([
      makeTicket('Alice', 'in_progress'),
      makeTicket('Alice', 'in_progress'),
      makeTicket('Alice', 'backlog'),
      makeTicket('Alice', 'backlog'),
      makeTicket('Alice', 'backlog'),
    ]);
    const report = await predictLoad('proj-1');
    const alice = report.agentForecasts.find((f) => f.agentType === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.currentLoad).toBe(2);
    expect(alice!.predictedLoad).toBe(3);
  });

  // AC2: rounding - 0 in_progress, 2 backlog → predictedLoad = round(2 × 0.3) = round(0.6) = 1
  it('rounds predictedLoad to integer', async () => {
    mockDbSelect([
      makeTicket('Bob', 'backlog'),
      makeTicket('Bob', 'backlog'),
    ]);
    const report = await predictLoad('proj-1');
    const bob = report.agentForecasts.find((f) => f.agentType === 'Bob');
    expect(bob).toBeDefined();
    expect(bob!.predictedLoad).toBe(1);
    expect(Number.isInteger(bob!.predictedLoad)).toBe(true);
  });

  // AC3: riskLevel mapping
  it('maps riskLevel correctly: ≥90% critical, ≥70% high, ≥50% moderate, <50% low', async () => {
    // predictedLoad=5 → utilization=100% → critical
    // predictedLoad=4 → utilization=80% → high
    // predictedLoad=3 → utilization=60% → moderate (rounded from 0 in_progress + backlog pushing it there)
    // predictedLoad=0 → utilization=0% → low

    // Agent Critical: 5 in_progress → predictedLoad=5, util=100%
    // Agent High: 4 in_progress → predictedLoad=4, util=80%
    // Agent Low: 0 tickets → won't appear — instead use 1 in_progress → util=20%
    mockDbSelect([
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('Moderate', 'in_progress'),
      makeTicket('Moderate', 'in_progress'),
      makeTicket('Moderate', 'in_progress'),
      makeTicket('Low', 'in_progress'),
    ]);
    const report = await predictLoad('proj-1');
    const critical = report.agentForecasts.find((f) => f.agentType === 'Critical');
    const high = report.agentForecasts.find((f) => f.agentType === 'High');
    const moderate = report.agentForecasts.find((f) => f.agentType === 'Moderate');
    const low = report.agentForecasts.find((f) => f.agentType === 'Low');
    expect(critical!.riskLevel).toBe('critical');
    expect(high!.riskLevel).toBe('high');
    expect(moderate!.riskLevel).toBe('moderate');
    expect(low!.riskLevel).toBe('low');
  });

  // AC6: agent cards sorted critical-first
  it('sorts agentForecasts critical-first', async () => {
    mockDbSelect([
      makeTicket('Low', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('Critical', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
      makeTicket('High', 'in_progress'),
    ]);
    const report = await predictLoad('proj-1');
    const riskOrder = report.agentForecasts.map((f) => f.riskLevel);
    const orderMap: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
    for (let i = 0; i < riskOrder.length - 1; i++) {
      expect(orderMap[riskOrder[i]]).toBeLessThanOrEqual(orderMap[riskOrder[i + 1]]);
    }
  });

  // AC7: bottleneck warnings for critical/high agents
  it('includes bottleneck warnings for critical and high risk agents', async () => {
    mockDbSelect([
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentB', 'in_progress'),
    ]);
    const report = await predictLoad('proj-1');
    expect(report.bottleneckWarnings.length).toBeGreaterThan(0);
    expect(report.bottleneckWarnings.some((w) => w.includes('AgentA'))).toBe(true);
  });

  // AC8: fallback text when OpenRouter unavailable
  it('uses fallback aiInsight when AI call fails', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API unavailable')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    mockDbSelect([makeTicket('Alice', 'in_progress')]);
    const report = await predictLoad('proj-1');
    expect(report.aiInsight).toBe('Review agent assignments to balance workload across team.');
  });

  // AC1 + edge: empty project returns empty report
  it('returns empty forecasts and fallback insight when no pipeline tickets', async () => {
    mockDbSelect([]);
    const report = await predictLoad('proj-1');
    expect(report.agentForecasts).toHaveLength(0);
    expect(report.totalTicketsPipeline).toBe(0);
    expect(report.overloadedAgents).toBe(0);
    expect(report.aiInsight).toBe('Review agent assignments to balance workload across team.');
  });

  // AC7: overloadedAgents count matches critical+high count
  it('counts overloadedAgents as number of critical+high risk agents', async () => {
    mockDbSelect([
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentA', 'in_progress'),
      makeTicket('AgentB', 'in_progress'),
      makeTicket('AgentB', 'in_progress'),
      makeTicket('AgentB', 'in_progress'),
      makeTicket('AgentB', 'in_progress'),
      makeTicket('AgentC', 'in_progress'),
    ]);
    const report = await predictLoad('proj-1');
    const expectedOverloaded = report.agentForecasts.filter(
      (f) => f.riskLevel === 'critical' || f.riskLevel === 'high',
    ).length;
    expect(report.overloadedAgents).toBe(expectedOverloaded);
  });
});
