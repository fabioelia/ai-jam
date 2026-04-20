import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileAgentSkills } from './agent-skill-profiler-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Team has strong complexity handling with balanced skill distribution.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(data),
  };
}

function mockDb(ticketData: unknown[]) {
  const dbMock = db as unknown as { select: ReturnType<typeof vi.fn> };
  dbMock.select.mockImplementation(() => makeSelectChain(ticketData));
}

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  storyPoints: number | null = null,
  priority = 'medium',
) {
  return {
    id,
    title: `Ticket ${id}`,
    assignedPersona,
    status,
    storyPoints,
    priority,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profileAgentSkills', () => {
  it('returns empty profiles when no tickets with assignedPersona', async () => {
    mockDb([
      makeTicket('t1', null, 'done'),
      makeTicket('t2', null, 'backlog'),
    ]);
    const result = await profileAgentSkills('proj-1');
    expect(result.profiles).toHaveLength(0);
    expect(result.topExpert).toBeNull();
  });

  it('computes completionRate correctly (done / total * 100)', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'done'),
      makeTicket('t2', 'alice', 'done'),
      makeTicket('t3', 'alice', 'backlog'),
      makeTicket('t4', 'alice', 'in_progress'),
    ]);
    const result = await profileAgentSkills('proj-1');
    const alice = result.profiles.find((p) => p.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.completionRate).toBe(50);
    expect(alice!.totalAssigned).toBe(4);
    expect(alice!.completedCount).toBe(2);
  });

  it('computes complexityScore from priority weights of done tickets', async () => {
    // 1 critical (4) + 1 high (3) = 7 / 2 done = 3.5
    mockDb([
      makeTicket('t1', 'alice', 'done', null, 'critical'),
      makeTicket('t2', 'alice', 'done', null, 'high'),
      makeTicket('t3', 'alice', 'backlog', null, 'low'),
    ]);
    const result = await profileAgentSkills('proj-1');
    const alice = result.profiles.find((p) => p.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.complexityScore).toBe(3.5);
  });

  it('sets specialization to highest-count priority in done tickets', async () => {
    // 3 medium done, 1 high done → specialization = medium
    mockDb([
      makeTicket('t1', 'alice', 'done', null, 'medium'),
      makeTicket('t2', 'alice', 'done', null, 'medium'),
      makeTicket('t3', 'alice', 'done', null, 'medium'),
      makeTicket('t4', 'alice', 'done', null, 'high'),
    ]);
    const result = await profileAgentSkills('proj-1');
    const alice = result.profiles.find((p) => p.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.specialization).toBe('medium');
  });

  it("sets proficiencyTier = 'expert' when complexityScore >= 3", async () => {
    // 2 critical = 8 / 2 = 4.0 → expert
    mockDb([
      makeTicket('t1', 'alice', 'done', null, 'critical'),
      makeTicket('t2', 'alice', 'done', null, 'critical'),
    ]);
    const result = await profileAgentSkills('proj-1');
    const alice = result.profiles.find((p) => p.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.proficiencyTier).toBe('expert');
  });

  it("sets proficiencyTier = 'developing' when complexityScore < 2", async () => {
    // 2 low = 2 / 2 = 1.0 → developing
    mockDb([
      makeTicket('t1', 'alice', 'done', null, 'low'),
      makeTicket('t2', 'alice', 'done', null, 'low'),
    ]);
    const result = await profileAgentSkills('proj-1');
    const alice = result.profiles.find((p) => p.agentName === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.proficiencyTier).toBe('developing');
  });

  it('sets topExpert to agent with highest complexityScore', async () => {
    // alice: 2 critical = score 4.0, bob: 2 low = score 1.0
    mockDb([
      makeTicket('t1', 'alice', 'done', null, 'critical'),
      makeTicket('t2', 'alice', 'done', null, 'critical'),
      makeTicket('t3', 'bob', 'done', null, 'low'),
      makeTicket('t4', 'bob', 'done', null, 'low'),
    ]);
    const result = await profileAgentSkills('proj-1');
    expect(result.topExpert).toBe('alice');
  });

  it('falls back to heuristic insight on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));
    mockDb([makeTicket('t1', 'alice', 'done', 3, 'high')]);
    const result = await profileAgentSkills('proj-1');
    expect(result.insight).toBe('Skill profiles based on ticket completion history');
  });
});
