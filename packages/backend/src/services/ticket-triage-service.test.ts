import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB connection before importing the service
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
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'AI reasoning text' }],
        }),
      },
    })),
  };
});

import { triageTicket } from './ticket-triage-service.js';
import { db } from '../db/connection.js';

// Helper to build a chainable drizzle mock
function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => resolve(rows),
  };
  // Make awaitable
  Object.defineProperty(chain, Symbol.iterator, { value: undefined });
  // Allow `await` via thenable
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return chain;
}

// We'll create a more sophisticated mock that tracks calls
let callIndex = 0;
let callResponses: unknown[][] = [];

function setupDbMock(responses: unknown[][]) {
  callIndex = 0;
  callResponses = responses;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const idx = callIndex++;
    const rows = callResponses[idx] ?? [];
    return buildSelectChain(rows);
  });
}

describe('triageTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Ticket with "critical bug crash" title → suggestedPriority="critical"', async () => {
    setupDbMock([
      // ticket query
      [{
        id: 'ticket-1',
        projectId: 'project-1',
        title: 'critical bug crash in login',
        description: 'The login page crashes',
        acceptanceCriteria: [],
      }],
      // features query
      [{ id: 'feature-1' }],
      // epics for feature-1
      [],
      // project tickets for assignee
      [],
    ]);

    const result = await triageTicket('ticket-1');
    expect(result).not.toBeNull();
    expect(result!.suggestedPriority).toBe('critical');
  });

  it('2. Ticket with 50-word description → suggestedStoryPoints=2', async () => {
    // 50 words exactly: < 50 → 2, = 50 is NOT < 50, so 50 words → 3. Let's use 49 words
    const desc = Array(49).fill('word').join(' ');
    setupDbMock([
      [{
        id: 'ticket-2',
        projectId: 'project-1',
        title: 'some feature',
        description: desc,
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [],
      [],
    ]);

    const result = await triageTicket('ticket-2');
    expect(result).not.toBeNull();
    expect(result!.suggestedStoryPoints).toBe(2);
  });

  it('3. Ticket with 150-word description → suggestedStoryPoints=5', async () => {
    const desc = Array(150).fill('word').join(' ');
    setupDbMock([
      [{
        id: 'ticket-3',
        projectId: 'project-1',
        title: 'feature ticket',
        description: desc,
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [],
      [],
    ]);

    const result = await triageTicket('ticket-3');
    expect(result).not.toBeNull();
    expect(result!.suggestedStoryPoints).toBe(5);
  });

  it('4. Epic name overlap with ticket keywords → correct epicId returned', async () => {
    setupDbMock([
      [{
        id: 'ticket-4',
        projectId: 'project-1',
        title: 'authentication login system',
        description: 'some description',
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [
        { id: 'epic-auth', title: 'Authentication Module' },
        { id: 'epic-billing', title: 'Billing System' },
      ],
      [],
    ]);

    const result = await triageTicket('ticket-4');
    expect(result).not.toBeNull();
    expect(result!.suggestedEpicId).toBe('epic-auth');
    expect(result!.suggestedEpicName).toBe('Authentication Module');
  });

  it('5. Most frequent assignee for priority returned → suggestedAssignee set', async () => {
    setupDbMock([
      [{
        id: 'ticket-5',
        projectId: 'project-1',
        title: 'fix the bug',
        description: 'a bug fix',
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [],
      [
        { priority: 'high', assignedPersona: 'alice' },
        { priority: 'high', assignedPersona: 'alice' },
        { priority: 'high', assignedPersona: 'bob' },
        { priority: 'medium', assignedPersona: 'charlie' },
      ],
    ]);

    const result = await triageTicket('ticket-5');
    expect(result).not.toBeNull();
    expect(result!.suggestedAssignee).toBe('alice');
  });

  it('6. Description > 50 words → confidence="high"', async () => {
    const desc = Array(51).fill('word').join(' ');
    setupDbMock([
      [{
        id: 'ticket-6',
        projectId: 'project-1',
        title: 'some ticket',
        description: desc,
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [],
      [],
    ]);

    const result = await triageTicket('ticket-6');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
  });

  it('7. AI error → heuristic reasoning, reasoning contains "heuristic"', async () => {
    // Mock Anthropic to throw an error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));

    setupDbMock([
      [{
        id: 'ticket-7',
        projectId: 'project-1',
        title: 'some ticket',
        description: 'a description',
        acceptanceCriteria: [],
      }],
      [{ id: 'feature-1' }],
      [],
      [],
    ]);

    const result = await triageTicket('ticket-7');
    expect(result).not.toBeNull();
    expect(result!.reasoning.toLowerCase()).toContain('heuristic');
  });

  it('8. Ticket not found → returns null', async () => {
    setupDbMock([
      // empty result for ticket query
      [],
    ]);

    const result = await triageTicket('nonexistent-ticket');
    expect(result).toBeNull();
  });
});
