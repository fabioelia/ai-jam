/**
 * Unit tests for estimateStoryPoints service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track DB calls for assertions
interface DbCall {
  op: 'select';
  conditions?: unknown[];
  result?: unknown;
}
let dbCalls: DbCall[] = [];

let selectReturnValue: unknown[] = [];

// Mock DB
vi.mock('../db/connection.js', () => {
  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      const propStr = String(prop);

      if (propStr === 'select') {
        return () => {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.from = self;
          chain.where = self;
          chain.orderBy = self;
          chain.limit = () => {
            dbCalls.push({ op: 'select' });
            return Promise.resolve(selectReturnValue);
          };
          // Allow chain to resolve without .limit()
          chain.then = (resolve: (v: unknown) => void) => {
            dbCalls.push({ op: 'select' });
            return Promise.resolve(selectReturnValue).then(resolve);
          };
          return chain;
        };
      }

      return () => ({});
    },
  });
  return { db: mock };
});

vi.mock('../db/schema.js', () => ({
  tickets: {
    id: 'id', projectId: 'projectId', title: 'title', description: 'description',
    storyPoints: 'storyPoints', status: 'status', priority: 'priority',
    updatedAt: 'updatedAt', featureId: 'featureId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  and: (...args: unknown[]) => ({ and: args }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
  desc: (col: unknown) => ({ desc: col }),
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  dbCalls = [];
  selectReturnValue = [];
  mockCreate.mockReset();
});

describe('estimateStoryPoints', () => {
  it('returns fallback when ticket not found', async () => {
    selectReturnValue = [];

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('nonexistent-ticket');

    expect(result).toEqual({
      points: null,
      confidence: 'low',
      reasoning: 'Unable to estimate',
      similarTickets: [],
    });
  });

  it('returns fallback when AI call fails', async () => {
    // First select returns the target ticket, second returns reference tickets
    let callCount = 0;
    const originalSelect = selectReturnValue;

    // We need to handle two select calls: one for the target ticket, one for references
    // Since both use the same mock, we'll set up the target ticket return first
    selectReturnValue = [{
      id: 't-1',
      projectId: 'p-1',
      title: 'Test ticket',
      description: 'A test',
      status: 'backlog',
      priority: 'medium',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockRejectedValue(new Error('API error'));

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-1');

    expect(result).toEqual({
      points: null,
      confidence: 'low',
      reasoning: 'Unable to estimate',
      similarTickets: [],
    });
  });

  it('returns fallback when AI returns unparseable content', async () => {
    selectReturnValue = [{
      id: 't-1',
      projectId: 'p-1',
      title: 'Test ticket',
      description: 'A test',
      status: 'backlog',
      priority: 'medium',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-1');

    expect(result.points).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.reasoning).toBe('Unable to estimate');
    expect(result.similarTickets).toEqual([]);
  });

  it('parses AI response and returns estimation result', async () => {
    selectReturnValue = [{
      id: 't-1',
      projectId: 'p-1',
      title: 'Build login page',
      description: 'Implement OAuth login',
      status: 'backlog',
      priority: 'high',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 5,
          confidence: 'high',
          reasoning: 'Login with OAuth is moderate complexity based on similar tickets.',
          similarTickets: ['Build signup page', 'Add SSO support'],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-1');

    expect(result.points).toBe(5);
    expect(result.confidence).toBe('high');
    expect(result.reasoning).toBe('Login with OAuth is moderate complexity based on similar tickets.');
    expect(result.similarTickets).toEqual(['Build signup page', 'Add SSO support']);
  });

  it('rounds non-Fibonacci values to nearest Fibonacci', async () => {
    selectReturnValue = [{
      id: 't-2',
      projectId: 'p-1',
      title: 'Complex refactor',
      description: 'Refactor the entire codebase',
      status: 'backlog',
      priority: 'critical',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 7,
          confidence: 'medium',
          reasoning: 'Large refactor.',
          similarTickets: [],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-2');

    // 7 rounds to 8 (nearest Fibonacci)
    expect(result.points).toBe(8);
    expect(result.confidence).toBe('medium');
  });

  it('defaults confidence to low when invalid value returned', async () => {
    selectReturnValue = [{
      id: 't-3',
      projectId: 'p-1',
      title: 'Small fix',
      description: 'Fix typo',
      status: 'backlog',
      priority: 'low',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 1,
          confidence: 'super-high',
          reasoning: 'Just a typo.',
          similarTickets: [],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-3');

    expect(result.points).toBe(1);
    expect(result.confidence).toBe('low');
  });

  it('limits similarTickets to 5 entries', async () => {
    selectReturnValue = [{
      id: 't-4',
      projectId: 'p-1',
      title: 'Big feature',
      description: 'Build entire module',
      status: 'backlog',
      priority: 'high',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 13,
          confidence: 'low',
          reasoning: 'Very large scope.',
          similarTickets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-4');

    expect(result.similarTickets).toHaveLength(5);
  });

  it('defaults reasoning when not provided', async () => {
    selectReturnValue = [{
      id: 't-5',
      projectId: 'p-1',
      title: 'Task',
      description: 'Do something',
      status: 'backlog',
      priority: 'medium',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 3,
          confidence: 'medium',
          similarTickets: [],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-5');

    expect(result.reasoning).toBe('No reasoning provided');
  });

  it('returns null points when AI returns null/zero points', async () => {
    selectReturnValue = [{
      id: 't-6',
      projectId: 'p-1',
      title: 'Task',
      description: 'Do something',
      status: 'backlog',
      priority: 'medium',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 0,
          confidence: 'low',
          reasoning: 'Cannot estimate.',
          similarTickets: [],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-6');

    expect(result.points).toBeNull();
  });

  it('uses correct model and API key from environment', async () => {
    selectReturnValue = [{
      id: 't-7',
      projectId: 'p-1',
      title: 'Task',
      description: 'Do something',
      status: 'backlog',
      priority: 'medium',
      storyPoints: null,
      updatedAt: new Date().toISOString(),
    }];

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          points: 3,
          confidence: 'high',
          reasoning: 'Test.',
          similarTickets: [],
        }),
      }],
    });

    const { estimateStoryPoints } = await import('./estimate-service.js');
    await estimateStoryPoints('t-7');

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('qwen/qwen3-6b');
    expect(callArgs.max_tokens).toBe(512);
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toContain('story point estimator');
  });
});

describe('toFibonacci (via estimateStoryPoints)', () => {
  it('maps 1 to 1', async () => {
    selectReturnValue = [{
      id: 't-f1', projectId: 'p-1', title: 'T', description: '', status: 'backlog',
      priority: 'medium', storyPoints: null, updatedAt: new Date().toISOString(),
    }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ points: 1, confidence: 'low', reasoning: 'r', similarTickets: [] }) }],
    });
    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-f1');
    expect(result.points).toBe(1);
  });

  it('maps 4 to 3 (nearest Fibonacci)', async () => {
    selectReturnValue = [{
      id: 't-f4', projectId: 'p-1', title: 'T', description: '', status: 'backlog',
      priority: 'medium', storyPoints: null, updatedAt: new Date().toISOString(),
    }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ points: 4, confidence: 'low', reasoning: 'r', similarTickets: [] }) }],
    });
    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-f4');
    expect(result.points).toBe(3);
  });

  it('maps 6 to 5 (nearest Fibonacci)', async () => {
    selectReturnValue = [{
      id: 't-f6', projectId: 'p-1', title: 'T', description: '', status: 'backlog',
      priority: 'medium', storyPoints: null, updatedAt: new Date().toISOString(),
    }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ points: 6, confidence: 'low', reasoning: 'r', similarTickets: [] }) }],
    });
    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-f6');
    expect(result.points).toBe(5);
  });

  it('maps 10 to 8 (nearest Fibonacci)', async () => {
    selectReturnValue = [{
      id: 't-f10', projectId: 'p-1', title: 'T', description: '', status: 'backlog',
      priority: 'medium', storyPoints: null, updatedAt: new Date().toISOString(),
    }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ points: 10, confidence: 'low', reasoning: 'r', similarTickets: [] }) }],
    });
    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-f10');
    expect(result.points).toBe(8);
  });

  it('maps 20 to 13 (nearest Fibonacci)', async () => {
    selectReturnValue = [{
      id: 't-f20', projectId: 'p-1', title: 'T', description: '', status: 'backlog',
      priority: 'medium', storyPoints: null, updatedAt: new Date().toISOString(),
    }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ points: 20, confidence: 'low', reasoning: 'r', similarTickets: [] }) }],
    });
    const { estimateStoryPoints } = await import('./estimate-service.js');
    const result = await estimateStoryPoints('t-f20');
    expect(result.points).toBe(13);
  });
});
