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
        content: [{ type: 'text', text: JSON.stringify({ insights: ['AI insight.'], recommendations: ['AI rec.'] }) }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import { analyzeAgentPriorityAlignment } from '../services/agent-priority-alignment-service.js';

function makeSelectChain(ticketRows: unknown[], sessionRows: unknown[] = []) {
  let callCount = 0;
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(sessionRows);
    }),
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
    const chain = makeSelectChain(
      [{ id: '1', priority: 'high', assignedPersona: 'dev', status: 'in_progress', createdAt: new Date() }],
      [{ id: 's1', ticketId: '1', personaType: 'dev', status: 'completed', startedAt: new Date(), completedAt: new Date() }],
    );
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');

    expect(report).toMatchObject({
      projectId: 'proj-1',
      generatedAt: expect.any(String),
      summary: expect.objectContaining({
        totalAgents: expect.any(Number),
        avgAlignmentScore: expect.any(Number),
      }),
      agents: expect.any(Array),
      insights: expect.any(Array),
      recommendations: expect.any(Array),
    });
  });

  it('returns empty state when no tickets exist', async () => {
    const chain = makeSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-empty');

    expect(report.summary.totalAgents).toBe(0);
    expect(report.agents).toHaveLength(0);
    expect(report.insights).toHaveLength(1);
    expect(report.recommendations).toHaveLength(1);
  });

  it('agents sorted by priorityAlignmentScore descending', async () => {
    const chain = makeSelectChain(
      [
        { id: '1', priority: 'critical', assignedPersona: 'agent-a', status: 'done', createdAt: new Date() },
        { id: '2', priority: 'low', assignedPersona: 'agent-b', status: 'in_progress', createdAt: new Date() },
      ],
      [
        { id: 's1', ticketId: '1', personaType: 'agent-a', status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { id: 's2', ticketId: '2', personaType: 'agent-b', status: 'completed', startedAt: new Date(), completedAt: new Date() },
      ],
    );
    mockDb.select.mockReturnValue(chain);

    const report = await analyzeAgentPriorityAlignment('proj-1');
    const scores = report.agents.map(a => a.priorityAlignmentScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});
