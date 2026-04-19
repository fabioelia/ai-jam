import { describe, it, expect, vi, beforeEach } from 'vitest';

let dbCalls: { op: string }[] = [];
let selectReturnValue: unknown[] = [];

vi.mock('../db/connection.js', () => {
  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (String(prop) === 'select') {
        return () => {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.from = self;
          chain.where = self;
          chain.limit = () => {
            dbCalls.push({ op: 'select' });
            return Promise.resolve(selectReturnValue);
          };
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
  tickets: { id: 'id', title: 'title', description: 'description', type: 'type', projectId: 'projectId', status: 'status', assignedPersona: 'assignedPersona', priority: 'priority' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  and: (...args: unknown[]) => ({ and: args }),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  dbCalls = [];
  selectReturnValue = [];
  mockCreate.mockReset();
});

describe('generateSubtasks', () => {
  it('returns fallback when ticket not found', async () => {
    selectReturnValue = [];
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('nonexistent');
    expect(result).toEqual({ subtasks: [], confidence: 0, reasoning: 'Unable to generate sub-tasks' });
  });

  it('returns fallback when AI error occurs', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockRejectedValue(new Error('API down'));
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    expect(result.subtasks).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('returns fallback when AI returns unparseable content', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: 'desc', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    expect(result.subtasks).toEqual([]);
  });

  it('parses successful AI response', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Build login', description: 'OAuth login', type: 'story', assignedPersona: 'dev-bot', projectId: 'p-1' }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        subtasks: [
          { title: 'Create auth endpoint', description: 'Implement POST /auth/login with JWT token generation.', storyPoints: 3 },
          { title: 'Add login form UI', description: 'Build React form with email/password fields.', storyPoints: 2 },
        ],
        confidence: 0.85,
        reasoning: 'Focused on core auth flow.',
      }) }],
    });
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    expect(result.subtasks).toHaveLength(2);
    expect(result.subtasks[0].title).toBe('Create auth endpoint');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toBe('Focused on core auth flow.');
  });

  it('filters empty subtasks', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      subtasks: [
        { title: '', description: 'Empty title', storyPoints: 1 },
        { title: 'Valid', description: 'This should remain', storyPoints: 2 },
        { title: '  ', description: 'Whitespace title', storyPoints: 1 },
      ],
      confidence: 0.5,
      reasoning: 'test',
    }) }] });
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    // Empty and whitespace-only titles are filtered out
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0].title).toBe('Valid');
  });

  it('caps story points at 13 and min at 1', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      subtasks: [
        { title: 'Huge', description: 'Big one', storyPoints: 20 },
        { title: 'Tiny', description: 'Small one', storyPoints: 0.5 },
      ],
      confidence: 0.7,
      reasoning: 'bounds test',
    }) }] });
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    expect(result.subtasks[0].storyPoints).toBe(13);
    expect(result.subtasks[1].storyPoints).toBe(1);
  });

  it('caps subtasks at 8', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    const tooMany = Array.from({ length: 12 }, (_, i) => ({ title: `Task ${i}`, description: `Desc ${i}`, storyPoints: 2 }));
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      subtasks: tooMany,
      confidence: 0.6,
      reasoning: 'too many',
    }) }] });
    const { generateSubtasks } = await import('./subtask-generator-service.js');
    const result = await generateSubtasks('t-1');
    expect(result.subtasks).toHaveLength(8);
  });
});
