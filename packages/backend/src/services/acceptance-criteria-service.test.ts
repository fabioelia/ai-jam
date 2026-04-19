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

describe('generateAcceptanceCriteria', () => {
  it('returns fallback when ticket not found', async () => {
    selectReturnValue = [];
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('nonexistent');
    expect(result).toEqual({ criteria: [], confidence: 'low', reasoning: 'Unable to generate acceptance criteria' });
  });

  it('returns fallback when AI error occurs', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockRejectedValue(new Error('API down'));
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.criteria).toEqual([]);
    expect(result.confidence).toBe('low');
  });

  it('returns fallback when AI returns unparseable content', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: 'desc', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.criteria).toEqual([]);
  });

  it('parses successful AI response', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Build login', description: 'OAuth login', type: 'story', assignedPersona: 'dev-bot', projectId: 'p-1' }];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        criteria: ['Given user visits /login When they submit valid credentials Then they are redirected to dashboard'],
        confidence: 'high',
        reasoning: 'Focused on authentication flow.',
      }) }],
    });
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.criteria).toHaveLength(1);
    expect(result.confidence).toBe('high');
    expect(result.reasoning).toBe('Focused on authentication flow.');
  });

  it('filters empty criteria and caps at 10', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    const tooMany = Array.from({ length: 15 }, (_, i) => `Criterion ${i}`);
    tooMany.push('');
    tooMany.push('   ');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ criteria: tooMany, confidence: 'medium', reasoning: 'r' }) }] });
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.criteria).toHaveLength(10);
  });

  it('defaults confidence to low when invalid', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ criteria: ['test'], confidence: 'super-high', reasoning: '' }) }] });
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.confidence).toBe('low');
  });

  it('defaults reasoning when not provided', async () => {
    selectReturnValue = [{ id: 't-1', title: 'Test', description: '', type: 'story', assignedPersona: null }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ criteria: ['test'], confidence: 'high' }) }] });
    const { generateAcceptanceCriteria } = await import('./acceptance-criteria-service.js');
    const result = await generateAcceptanceCriteria('t-1');
    expect(result.reasoning).toBe('No reasoning provided');
  });
});
