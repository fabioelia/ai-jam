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
  tickets: { id: 'id', title: 'title', description: 'description', status: 'status', priority: 'priority', projectId: 'projectId', storyPoints: 'storyPoints', assignedPersona: 'assignedPersona', epicId: 'epicId', acceptanceCriteria: 'acceptanceCriteria' },
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

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: 't-1',
  title: 'Create user login form with email validation',
  description: 'Implement a login form that allows users to enter their email and password. The form should validate the email format before submitting and display an error message if invalid.',
  status: 'backlog',
  priority: 'high',
  projectId: 'p-1',
  storyPoints: 5,
  assignedPersona: 'frontend-dev',
  epicId: 'epic-1',
  acceptanceCriteria: ['Email validation shows inline errors', 'Submit disabled when form invalid', 'Password field masks input', 'Successful login redirects to dashboard'],
  createdAt: '2026-04-19T00:00:00Z',
  updatedAt: '2026-04-19T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  selectReturnValue = [];
  mockCreate.mockReset();
});

describe('scoreTicketQuality', () => {
  it('returns fallback when ticket not found', async () => {
    selectReturnValue = [];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-missing');
    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.suggestions).toEqual(['Ticket not found']);
    expect(result.confidence).toBe('low');
  });

  it('minimal ticket (title only) → low scores, suggestions present', async () => {
    selectReturnValue = [makeTicket({ title: 'fix stuff', description: null, storyPoints: null, assignedPersona: null, epicId: null, acceptanceCriteria: [], priority: 'medium' })];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.overallScore).toBeLessThan(50);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.dimensions.clarity.score).toBeLessThan(50);
    expect(result.dimensions.completeness.score).toBeLessThan(50);
    expect(result.dimensions.sizing.score).toBe(0);
  });

  it('perfect ticket → high score, grade A', async () => {
    selectReturnValue = [makeTicket()];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(['All dimensions look good, consider adding edge case acceptance criteria for slow network.', 'Add error boundary for form submission timeout.']) }] });
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.grade).toBe('A');
    expect(result.confidence).toBe('high');
  });

  it('short title (<8 chars) → clarity penalized', async () => {
    selectReturnValue = [makeTicket({ title: 'abc' })];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.dimensions.clarity.score).toBeLessThan(50);
    expect(result.dimensions.clarity.note).toContain('title too short');
  });

  it('no acceptance criteria → completeness penalized', async () => {
    selectReturnValue = [makeTicket({ acceptanceCriteria: [] })];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.dimensions.completeness.score).toBeLessThan(70);
    expect(result.dimensions.completeness.note).toContain('no acceptance criteria');
  });

  it('storyPoints set to 0 → sizing penalized', async () => {
    selectReturnValue = [makeTicket({ storyPoints: 0 })];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.dimensions.sizing.score).toBeLessThan(50);
    expect(result.dimensions.sizing.note).toContain('story points set to 0');
  });

  it('no assignedPersona → readiness penalized', async () => {
    selectReturnValue = [makeTicket({ assignedPersona: null })];
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    expect(result.dimensions.readiness.score).toBeLessThanOrEqual(60);
    expect(result.dimensions.readiness.note).toContain('no assigned persona');
  });

  it('AI error → deterministic scores still returned, suggestions use fallback', async () => {
    selectReturnValue = [makeTicket({ assignedPersona: null, epicId: null })];
    mockCreate.mockRejectedValue(new Error('API down'));
    const { scoreTicketQuality } = await import('./ticket-quality-service.js');
    const result = await scoreTicketQuality('t-1');
    // Deterministic scores always computed
    expect(result.dimensions.clarity.score).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.completeness.score).toBeGreaterThanOrEqual(0);
    // Suggestions fall back to deterministic text
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.confidence).toBeTruthy();
  });
});
