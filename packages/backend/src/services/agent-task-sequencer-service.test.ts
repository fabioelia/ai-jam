import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sequenceTasks } from './agent-task-sequencer-service.js';

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

function makeTicket(
  assignedPersona: string | null,
  status: string,
  priority: string | null,
  storyPoints: number | null = null,
) {
  return {
    id: `ticket-${Math.random().toString(36).slice(2)}`,
    title: `Ticket for ${assignedPersona}`,
    status,
    priority,
    assignedPersona,
    storyPoints,
    updatedAt: new Date(),
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

describe('sequenceTasks', () => {
  it('returns empty agentSequences when all tickets have null assignedPersona', async () => {
    mockDbSelect([
      makeTicket(null, 'in_progress', 'high'),
      makeTicket(null, 'backlog', 'medium'),
    ]);
    const report = await sequenceTasks('proj-1');
    expect(report.agentSequences).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
    expect(report.totalTickets).toBe(0);
  });

  it('prioritizes in_progress over backlog at same priority', async () => {
    mockDbSelect([
      makeTicket('Alice', 'backlog', 'high'),
      makeTicket('Alice', 'in_progress', 'high'),
    ]);
    const report = await sequenceTasks('proj-1');
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.sequence[0].status).toBe('in_progress');
  });

  it('quick-win bonus: storyPoints=1 scores higher than storyPoints=5 at same priority/status', async () => {
    mockDbSelect([
      makeTicket('Alice', 'backlog', 'high', 5),
      makeTicket('Alice', 'backlog', 'high', 1),
    ]);
    const report = await sequenceTasks('proj-1');
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.sequence[0].storyPoints).toBe(1);
  });

  it('quick-win bonus: storyPoints=2 gets +15; storyPoints=3 gets 0', async () => {
    mockDbSelect([
      makeTicket('Alice', 'backlog', 'medium', 3),
      makeTicket('Alice', 'backlog', 'medium', 2),
    ]);
    const report = await sequenceTasks('proj-1');
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    expect(alice).toBeDefined();
    // storyPoints=2 gets +15 bonus, storyPoints=3 gets 0 → 2-point ticket should rank first
    expect(alice!.sequence[0].storyPoints).toBe(2);
    expect(alice!.sequence[0].score).toBeGreaterThan(alice!.sequence[1].score);
  });

  it('large ticket penalty: storyPoints=8 gets -10; storyPoints=7 gets 0', async () => {
    mockDbSelect([
      makeTicket('Alice', 'backlog', 'medium', 8),
      makeTicket('Alice', 'backlog', 'medium', 7),
    ]);
    const report = await sequenceTasks('proj-1');
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    expect(alice).toBeDefined();
    // storyPoints=7 gets 0 penalty, storyPoints=8 gets -10 → 7-point ticket ranks first
    expect(alice!.sequence[0].storyPoints).toBe(7);
    expect(alice!.sequence[0].score).toBeGreaterThan(alice!.sequence[1].score);
  });

  it('groups tickets correctly by assignedPersona (2 agents each get own sequence)', async () => {
    mockDbSelect([
      makeTicket('Alice', 'in_progress', 'high'),
      makeTicket('Alice', 'backlog', 'low'),
      makeTicket('Bob', 'review', 'critical'),
      makeTicket('Bob', 'qa', 'medium'),
    ]);
    const report = await sequenceTasks('proj-1');
    expect(report.agentSequences).toHaveLength(2);
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    const bob = report.agentSequences.find((a) => a.agentName === 'Bob');
    expect(alice!.ticketCount).toBe(2);
    expect(bob!.ticketCount).toBe(2);
  });

  it('sorts agentSequences by agentName ascending', async () => {
    mockDbSelect([
      makeTicket('Charlie', 'in_progress', 'high'),
      makeTicket('Alice', 'backlog', 'medium'),
      makeTicket('Bob', 'review', 'low'),
    ]);
    const report = await sequenceTasks('proj-1');
    expect(report.agentSequences[0].agentName).toBe('Alice');
    expect(report.agentSequences[1].agentName).toBe('Bob');
    expect(report.agentSequences[2].agentName).toBe('Charlie');
  });

  it('falls back to default rationale on AI error', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API error')),
      },
    }) as unknown as InstanceType<typeof Anthropic>);

    mockDbSelect([
      makeTicket('Alice', 'in_progress', 'critical'),
      makeTicket('Alice', 'backlog', 'high'),
    ]);
    const report = await sequenceTasks('proj-1');
    const alice = report.agentSequences.find((a) => a.agentName === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.sequence[0].rationale).toBe('High priority — work on this next');
  });
});
