import { describe, it, expect, vi, beforeEach } from 'vitest';

let selectReturnValue: unknown[] = [];

vi.mock('../db/connection.js', () => {
  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (String(prop) === 'select') {
        return () => {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.from = self;
          chain.where = () => ({
            then: (resolve: (v: unknown) => void) =>
              Promise.resolve(selectReturnValue).then(resolve),
          });
          return chain;
        };
      }
      return () => ({});
    },
  });
  return { db: mock };
});

vi.mock('../db/schema.js', () => ({
  tickets: { id: 'id', title: 'title', status: 'status', priority: 'priority', projectId: 'projectId', assignedPersona: 'assignedPersona', storyPoints: 'storyPoints' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

const makeTicket = (status: string, id = 't-1', pts = 3) => ({
  id, title: `Ticket ${id}`, status, priority: 'medium', projectId: 'p-1', assignedPersona: null, storyPoints: pts,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  selectReturnValue = [];
  mockCreate.mockReset();
});

describe('generateRetrospective', () => {
  it('returns fallback when project has no tickets', async () => {
    selectReturnValue = [];
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-empty');
    expect(result).toEqual({
      wentWell: [], improvements: [], actionItems: [], velocity: { planned: 0, completed: 0 },
      confidence: 0, reasoning: 'Unable to generate retrospective',
    });
  });

  it('returns fallback when AI client throws', async () => {
    selectReturnValue = [makeTicket('done')];
    mockCreate.mockRejectedValue(new Error('API down'));
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-1');
    expect(result.wentWell).toEqual([]);
    expect(result.actionItems).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe('Unable to generate retrospective');
  });

  it('returns fallback when AI returns unparseable content', async () => {
    selectReturnValue = [makeTicket('in_progress')];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json at all' }] });
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-1');
    expect(result.wentWell).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('parses successful AI response with all sections', async () => {
    selectReturnValue = [
      makeTicket('done', 't-1', 5),
      makeTicket('review', 't-2', 3),
      makeTicket('in_progress', 't-3', 8),
      makeTicket('blocked', 't-4', 2),
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        wentWell: ['Delivered auth refactor on time', 'Completed API rate limiting'],
        improvements: ['Blocked ticket waiting on design', 'In-progress work incomplete'],
        actionItems: ['Prioritize design review', 'Break large tickets into smaller chunks'],
        velocity: { planned: 18, completed: 8 },
        confidence: 0.85,
        reasoning: 'Good delivery on core items but blockers slowed progress.',
      }) }],
    });
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-1');
    expect(result.wentWell).toEqual(['Delivered auth refactor on time', 'Completed API rate limiting']);
    expect(result.improvements).toEqual(['Blocked ticket waiting on design', 'In-progress work incomplete']);
    expect(result.actionItems).toEqual(['Prioritize design review', 'Break large tickets into smaller chunks']);
    expect(result.velocity).toEqual({ planned: 18, completed: 8 });
    expect(result.confidence).toBe(0.85);
  });

  it('returns empty action items array (not null/undefined) when AI returns empty', async () => {
    selectReturnValue = [makeTicket('done')];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        wentWell: ['Completed work'],
        improvements: ['Minor delays'],
        actionItems: [],
        velocity: { planned: 3, completed: 3 },
        confidence: 0.7,
        reasoning: 'Sprint went well.',
      }) }],
    });
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-1');
    expect(Array.isArray(result.actionItems)).toBe(true);
    expect(result.actionItems).toEqual([]);
  });

  it('calculates velocity from DB data when AI omits velocity fields', async () => {
    selectReturnValue = [
      makeTicket('done', 't-1', 5),
      makeTicket('done', 't-2', 3),
      makeTicket('in_progress', 't-3', 8),
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        wentWell: ['Finished two tickets'],
        improvements: ['One ticket still open'],
        actionItems: ['Focus on closing loops'],
        confidence: 0.8,
        reasoning: 'Partial delivery.',
      }) }],
    });
    const { generateRetrospective } = await import('./retrospective-service.js');
    const result = await generateRetrospective('p-1');
    expect(result.velocity).toEqual({ planned: 16, completed: 8 });
  });

  it('clamps confidence above 1.0 to 1.0 and below 0 to 0', async () => {
    selectReturnValue = [makeTicket('done')];

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        wentWell: ['Work done'], improvements: [], actionItems: [],
        velocity: { planned: 3, completed: 3 }, confidence: 1.5, reasoning: 'High confidence.',
      }) }],
    });
    const { generateRetrospective } = await import('./retrospective-service.js');
    const high = await generateRetrospective('p-1');
    expect(high.confidence).toBe(1);

    vi.resetModules();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        wentWell: [], improvements: [], actionItems: [],
        velocity: { planned: 3, completed: 3 }, confidence: -0.3, reasoning: 'Low confidence.',
      }) }],
    });
    const { generateRetrospective: gen2 } = await import('./retrospective-service.js');
    const low = await gen2('p-1');
    expect(low.confidence).toBe(0);
  });
});
