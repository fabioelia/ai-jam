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
  tickets: { id: 'id', title: 'title', status: 'status', priority: 'priority', projectId: 'projectId', assignedPersona: 'assignedPersona' },
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

const makeTicket = (status: string, id = 't-1') => ({
  id, title: `Ticket ${id}`, status, priority: 'medium', projectId: 'p-1', assignedPersona: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  selectReturnValue = [];
  mockCreate.mockReset();
});

describe('generateStandupReport', () => {
  it('returns fallback when project has no tickets', async () => {
    selectReturnValue = [];
    const { generateStandupReport } = await import('./standup-report-service.js');
    const result = await generateStandupReport('p-empty');
    expect(result).toEqual({ yesterday: [], today: [], blockers: [], confidence: 0, reasoning: 'Unable to generate standup report' });
  });

  it('returns fallback when AI client throws', async () => {
    selectReturnValue = [makeTicket('in_progress')];
    mockCreate.mockRejectedValue(new Error('API down'));
    const { generateStandupReport } = await import('./standup-report-service.js');
    const result = await generateStandupReport('p-1');
    expect(result.yesterday).toEqual([]);
    expect(result.today).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('returns fallback when AI returns unparseable content', async () => {
    selectReturnValue = [makeTicket('in_progress')];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json at all' }] });
    const { generateStandupReport } = await import('./standup-report-service.js');
    const result = await generateStandupReport('p-1');
    expect(result.yesterday).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('parses successful AI response with all 3 sections', async () => {
    selectReturnValue = [makeTicket('done'), makeTicket('in_progress', 't-2'), makeTicket('blocked', 't-3')];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        yesterday: ['Completed auth refactor'],
        today: ['Working on ticket UI'],
        blockers: ['Waiting on design review'],
        confidence: 0.9,
        reasoning: 'Clear board state with distinct sections.',
      }) }],
    });
    const { generateStandupReport } = await import('./standup-report-service.js');
    const result = await generateStandupReport('p-1');
    expect(result.yesterday).toEqual(['Completed auth refactor']);
    expect(result.today).toEqual(['Working on ticket UI']);
    expect(result.blockers).toEqual(['Waiting on design review']);
    expect(result.confidence).toBe(0.9);
    expect(result.reasoning).toBe('Clear board state with distinct sections.');
  });

  it('returns empty blockers array (not null/undefined) when blockers section is empty', async () => {
    selectReturnValue = [makeTicket('in_progress')];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        yesterday: [],
        today: ['In progress work'],
        blockers: [],
        confidence: 0.7,
        reasoning: 'No blockers found.',
      }) }],
    });
    const { generateStandupReport } = await import('./standup-report-service.js');
    const result = await generateStandupReport('p-1');
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('clamps confidence above 1.0 to 1.0 and below 0 to 0', async () => {
    selectReturnValue = [makeTicket('done')];

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        yesterday: ['Work done'], today: [], blockers: [], confidence: 1.5, reasoning: 'High confidence.',
      }) }],
    });
    const { generateStandupReport } = await import('./standup-report-service.js');
    const high = await generateStandupReport('p-1');
    expect(high.confidence).toBe(1);

    vi.resetModules();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        yesterday: [], today: [], blockers: [], confidence: -0.3, reasoning: 'Low confidence.',
      }) }],
    });
    const { generateStandupReport: gen2 } = await import('./standup-report-service.js');
    const low = await gen2('p-1');
    expect(low.confidence).toBe(0);
  });
});
