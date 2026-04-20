import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the service
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI recommendation text.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import { analyzeAgentPriorityAlignment } from '../services/agent-priority-alignment-service.js';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  return chain;
}

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentPriorityAlignment', () => {
  it('returns report with correct shape', async () => {
    const chain = makeSelectChain([
      { id: '1', priority: 'high', assignedPersona: 'dev' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');

    expect(report).toMatchObject({
      projectId: 'proj-1',
      analyzedAt: expect.any(String),
      totalAgentsAnalyzed: expect.any(Number),
      totalActiveTickets: expect.any(Number),
      alignedAgents: expect.any(Number),
      driftingAgents: expect.any(Number),
      misalignedAgents: expect.any(Number),
      agentRecords: expect.any(Array),
      aiRecommendation: expect.any(String),
    });
  });

  it('calculates alignmentScore correctly (critical=1.0, medium=0.5)', async () => {
    const chain = makeSelectChain([
      { id: '1', priority: 'critical', assignedPersona: 'agent-a' },
      { id: '2', priority: 'medium', assignedPersona: 'agent-b' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const agentA = report.agentRecords.find((r) => r.agentPersona === 'agent-a')!;
    const agentB = report.agentRecords.find((r) => r.agentPersona === 'agent-b')!;

    expect(agentA.alignmentScore).toBeCloseTo(1.0);
    expect(agentB.alignmentScore).toBeCloseTo(0.5);
  });

  it('sets alignmentStatus=aligned when score >= 0.75', async () => {
    const chain = makeSelectChain([
      { id: '1', priority: 'critical', assignedPersona: 'agent-x' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const agent = report.agentRecords[0];

    expect(agent.alignmentScore).toBeGreaterThanOrEqual(0.75);
    expect(agent.alignmentStatus).toBe('aligned');
  });

  it('sets alignmentStatus=drifting when 0.4 <= score < 0.75', async () => {
    // medium (rank 2) + low (rank 1) = avg 1.5 / 4 = 0.375... not quite drifting
    // high (rank 3) + low (rank 1) = avg 2 / 4 = 0.5 — drifting
    const chain = makeSelectChain([
      { id: '1', priority: 'high', assignedPersona: 'agent-d' },
      { id: '2', priority: 'low', assignedPersona: 'agent-d' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const agent = report.agentRecords[0];

    expect(agent.alignmentScore).toBeGreaterThanOrEqual(0.4);
    expect(agent.alignmentScore).toBeLessThan(0.75);
    expect(agent.alignmentStatus).toBe('drifting');
  });

  it('sets alignmentStatus=misaligned when score < 0.4', async () => {
    // low (rank 1) / 4 = 0.25 — misaligned
    const chain = makeSelectChain([
      { id: '1', priority: 'low', assignedPersona: 'agent-m' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const agent = report.agentRecords[0];

    expect(agent.alignmentScore).toBeLessThan(0.4);
    expect(agent.alignmentStatus).toBe('misaligned');
  });

  it('sorts agentRecords ascending by alignmentScore (misaligned first)', async () => {
    const chain = makeSelectChain([
      { id: '1', priority: 'critical', assignedPersona: 'high-agent' },
      { id: '2', priority: 'low', assignedPersona: 'low-agent' },
      { id: '3', priority: 'medium', assignedPersona: 'mid-agent' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const scores = report.agentRecords.map((r) => r.alignmentScore);

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('returns empty state when no in_progress tickets exist', async () => {
    const chain = makeSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-empty');

    expect(report.totalAgentsAnalyzed).toBe(0);
    expect(report.totalActiveTickets).toBe(0);
    expect(report.agentRecords).toHaveLength(0);
    expect(report.aiRecommendation).toBe(
      'Ensure agents address critical and high-priority tickets before medium and low-priority work.',
    );
  });

  it('uses fallback recommendation when OpenRouter is unavailable', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    }));

    const chain = makeSelectChain([
      { id: '1', priority: 'high', assignedPersona: 'agent-z' },
    ]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');

    expect(report.aiRecommendation).toBe(
      'Ensure agents address critical and high-priority tickets before medium and low-priority work.',
    );
  });
});
