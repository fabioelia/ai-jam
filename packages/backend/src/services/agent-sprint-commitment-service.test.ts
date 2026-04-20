import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeSprintCommitment } from './agent-sprint-commitment-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Balance workload across agents for better commitment rates.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

const NOW = new Date();
const RECENT = new Date(NOW.getTime() - 5 * 86400000);   // 5 days ago — in window
const OLD = new Date(NOW.getTime() - 20 * 86400000);     // 20 days ago — outside window

function makeTicket(
  assignedPersona: string | null,
  status: string,
  createdAt: Date = RECENT,
  updatedAt: Date = RECENT,
) {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    status,
    assignedPersona,
    createdAt,
    updatedAt,
  };
}

function mockDbSelect(rows: ReturnType<typeof makeTicket>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeSprintCommitment', () => {
  // AC1: returns SprintCommitmentReport shape
  it('returns a valid SprintCommitmentReport shape', async () => {
    mockDbSelect([makeTicket('Alice', 'done')]);
    const report = await analyzeSprintCommitment('proj-1');
    expect(report).toMatchObject({
      projectId: 'proj-1',
      sprintWindowDays: 14,
      totalPlanned: expect.any(Number),
      totalCompleted: expect.any(Number),
      overallCommitmentRatio: expect.any(Number),
      overcommittedAgents: expect.any(Number),
      onTrackAgents: expect.any(Number),
      underutilizedAgents: expect.any(Number),
      agentRecords: expect.any(Array),
      aiRecommendation: expect.any(String),
      analyzedAt: expect.any(String),
    });
  });

  // AC2: plannedTickets = created in last 14 days; completedTickets = done + updated in last 14 days
  it('counts planned and completed tickets per agent correctly', async () => {
    mockDbSelect([
      makeTicket('Alice', 'done', RECENT, RECENT),    // planned + completed
      makeTicket('Alice', 'in_progress', RECENT, RECENT), // planned only
      makeTicket('Alice', 'done', OLD, OLD),           // neither (outside window)
    ]);
    const report = await analyzeSprintCommitment('proj-1');
    const alice = report.agentRecords.find((r) => r.agentType === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.plannedTickets).toBe(2);   // 2 created in window
    expect(alice!.completedTickets).toBe(1); // 1 done + updatedAt in window
  });

  // AC3: commitmentRatio = completedTickets / plannedTickets; 0 when plannedTickets=0
  it('computes commitmentRatio correctly and returns 0 when no planned tickets', async () => {
    mockDbSelect([makeTicket('Alice', 'done', RECENT, RECENT), makeTicket('Alice', 'done', RECENT, RECENT)]);
    const report = await analyzeSprintCommitment('proj-1');
    const alice = report.agentRecords.find((r) => r.agentType === 'Alice');
    expect(alice!.commitmentRatio).toBeCloseTo(1.0, 5);

    // Agent with completed but NOT planned (completed outside create window)
    mockDbSelect([makeTicket('Bob', 'done', OLD, RECENT)]);
    const report2 = await analyzeSprintCommitment('proj-1');
    const bob = report2.agentRecords.find((r) => r.agentType === 'Bob');
    expect(bob!.plannedTickets).toBe(0);
    expect(bob!.commitmentRatio).toBe(0);
  });

  // AC4: status mapping
  it('maps status correctly: ratio<0.6=overcommitted, >1.2=underutilized, else on-track', async () => {
    // Agent A: 1 planned, 0 completed → ratio=0 → overcommitted
    // Agent B: 5 planned, 3 completed → ratio=0.6 → on-track
    // Agent C: 1 planned, 2 completed (1 old create but recent done) — need explicit setup
    mockDbSelect([
      makeTicket('AgentA', 'in_progress', RECENT, RECENT),  // planned, not completed
      makeTicket('AgentB', 'done', RECENT, RECENT),
      makeTicket('AgentB', 'done', RECENT, RECENT),
      makeTicket('AgentB', 'done', RECENT, RECENT),
      makeTicket('AgentB', 'in_progress', RECENT, RECENT),
      makeTicket('AgentB', 'in_progress', RECENT, RECENT),
    ]);
    const report = await analyzeSprintCommitment('proj-1');
    const agentA = report.agentRecords.find((r) => r.agentType === 'AgentA');
    const agentB = report.agentRecords.find((r) => r.agentType === 'AgentB');
    expect(agentA!.status).toBe('overcommitted'); // ratio=0 < 0.6
    expect(agentB!.status).toBe('on-track');      // ratio=0.6 (3/5)
  });

  it('marks underutilized when ratio > 1.2', async () => {
    // 1 planned, 2 completed (ratio=2.0 > 1.2)
    // Use OLD createAt for 1 completed so it's not planned but still completed in window
    mockDbSelect([
      makeTicket('AgentC', 'done', RECENT, RECENT), // planned + completed
      makeTicket('AgentC', 'done', OLD, RECENT),    // not planned, but completed — adds to completedMap
    ]);
    const report = await analyzeSprintCommitment('proj-1');
    const agentC = report.agentRecords.find((r) => r.agentType === 'AgentC');
    expect(agentC!.status).toBe('underutilized'); // ratio=2/1=2.0 > 1.2
  });

  // AC7: sorted by commitmentRatio ascending (overcommitted first)
  it('sorts agentRecords by commitmentRatio ascending', async () => {
    mockDbSelect([
      makeTicket('High', 'done', RECENT, RECENT),
      makeTicket('High', 'done', RECENT, RECENT),
      makeTicket('High', 'done', RECENT, RECENT),
      makeTicket('Low', 'in_progress', RECENT, RECENT),
      makeTicket('Low', 'in_progress', RECENT, RECENT),
      makeTicket('Mid', 'done', RECENT, RECENT),
      makeTicket('Mid', 'in_progress', RECENT, RECENT),
    ]);
    const report = await analyzeSprintCommitment('proj-1');
    const ratios = report.agentRecords.map((r) => r.commitmentRatio);
    for (let i = 0; i < ratios.length - 1; i++) {
      expect(ratios[i]).toBeLessThanOrEqual(ratios[i + 1]);
    }
  });

  // AC8: fallback when AI fails
  it('uses fallback aiRecommendation when AI call fails', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API down')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    mockDbSelect([makeTicket('Alice', 'done', RECENT, RECENT)]);
    const report = await analyzeSprintCommitment('proj-1');
    expect(report.aiRecommendation).toBe(
      'Review agent capacity allocation to optimize sprint commitment rates.',
    );
  });

  // Empty project
  it('returns empty report when no tickets found', async () => {
    mockDbSelect([]);
    const report = await analyzeSprintCommitment('proj-1');
    expect(report.agentRecords).toHaveLength(0);
    expect(report.totalPlanned).toBe(0);
    expect(report.totalCompleted).toBe(0);
    expect(report.overallCommitmentRatio).toBe(0);
    expect(report.aiRecommendation).toBe(
      'Review agent capacity allocation to optimize sprint commitment rates.',
    );
  });
});
