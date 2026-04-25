import { describe, it, expect, vi, beforeEach } from 'vitest';

let candidateRows: unknown[] = [];

vi.mock('../db/connection.js', () => {
  const mock = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            then: (resolve: (v: unknown[]) => void) =>
              Promise.resolve(candidateRows).then(resolve),
          })),
        })),
      })),
    })),
  };
  return { db: mock };
});

vi.mock('../db/schema.js', () => ({
  tickets: { id: 'id', title: 'title', status: 'status', priority: 'priority', projectId: 'projectId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
  and: (...args: unknown[]) => ({ and: args }),
  notInArray: (col: unknown, vals: unknown) => ({ notInArray: [col, vals] }),
}));

vi.mock('../config.js', () => ({
  config: { openrouterApiKey: 'test-key', openrouterBaseUrl: 'https://api.test', aiModel: 'test-model' },
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const TICKET_A = { id: 'aaaa-0001', title: 'Build auth service', status: 'in_progress', priority: 'high' };
const TICKET_B = { id: 'bbbb-0002', title: 'Create login form', status: 'backlog', priority: 'medium' };
const TICKET_C = { id: 'cccc-0003', title: 'Add OAuth support', status: 'review', priority: 'high' };

function makeAISuggestions(suggestions: object[]) {
  return { content: [{ type: 'text', text: JSON.stringify(suggestions) }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  candidateRows = [];
  mockCreate.mockReset();
});

describe('suggestDependencies', () => {
  it('returns empty array when no candidate tickets exist', async () => {
    candidateRows = [];
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'New feature', 'Does something', undefined);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns enriched suggestions from AI', async () => {
    candidateRows = [TICKET_A, TICKET_B];
    mockCreate.mockResolvedValue(makeAISuggestions([
      { ticketId: 'aaaa-0001', relationship: 'blocked_by', confidence: 0.85, reason: 'Auth service must exist first.' },
    ]));
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'Login page', 'Needs auth', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].ticketId).toBe('aaaa-0001');
    expect(result[0].ticket.title).toBe('Build auth service');
    expect(result[0].relationship).toBe('blocked_by');
  });

  it('filters out suggestions with confidence < 0.6', async () => {
    candidateRows = [TICKET_A, TICKET_B, TICKET_C];
    mockCreate.mockResolvedValue(makeAISuggestions([
      { ticketId: 'aaaa-0001', relationship: 'related', confidence: 0.9, reason: 'High confidence.' },
      { ticketId: 'bbbb-0002', relationship: 'related', confidence: 0.5, reason: 'Low confidence.' },
      { ticketId: 'cccc-0003', relationship: 'blocks', confidence: 0.3, reason: 'Very low.' },
    ]));
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'Test feature', '', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9);
  });

  it('limits to 5 suggestions ordered by confidence desc', async () => {
    candidateRows = [TICKET_A, TICKET_B, TICKET_C,
      { id: 'dddd-0004', title: 'D', status: 'backlog', priority: 'low' },
      { id: 'eeee-0005', title: 'E', status: 'backlog', priority: 'low' },
      { id: 'ffff-0006', title: 'F', status: 'backlog', priority: 'low' },
    ];
    mockCreate.mockResolvedValue(makeAISuggestions([
      { ticketId: 'aaaa-0001', relationship: 'related', confidence: 0.7, reason: 'r' },
      { ticketId: 'bbbb-0002', relationship: 'related', confidence: 0.95, reason: 'r' },
      { ticketId: 'cccc-0003', relationship: 'related', confidence: 0.8, reason: 'r' },
      { ticketId: 'dddd-0004', relationship: 'related', confidence: 0.75, reason: 'r' },
      { ticketId: 'eeee-0005', relationship: 'related', confidence: 0.65, reason: 'r' },
      { ticketId: 'ffff-0006', relationship: 'related', confidence: 0.62, reason: 'r' },
    ]));
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'T', 'D', undefined);
    expect(result).toHaveLength(5);
    expect(result[0].confidence).toBe(0.95);
    expect(result[4].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('parses AI JSON from code block', async () => {
    candidateRows = [TICKET_A];
    const suggestions = [{ ticketId: 'aaaa-0001', relationship: 'blocks', confidence: 0.75, reason: 'Code block test.' }];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(suggestions) + '\n```' }] });
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'T', '', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].relationship).toBe('blocks');
  });

  it('returns empty on AI parse failure', async () => {
    candidateRows = [TICKET_A];
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'No suggestions at this time.' }] });
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'T', '', undefined);
    expect(result).toEqual([]);
  });

  it('uses Unknown fallback for ticket not in candidate map', async () => {
    candidateRows = [TICKET_A];
    mockCreate.mockResolvedValue(makeAISuggestions([
      { ticketId: 'zzzz-9999', relationship: 'related', confidence: 0.8, reason: 'Unknown ticket.' },
    ]));
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'T', '', undefined);
    expect(result[0].ticket.title).toBe('Unknown');
    expect(result[0].ticket.status).toBe('unknown');
  });

  it('invalid relationship type falls back to related', async () => {
    candidateRows = [TICKET_A];
    mockCreate.mockResolvedValue(makeAISuggestions([
      { ticketId: 'aaaa-0001', relationship: 'dependsOn', confidence: 0.9, reason: 'Bad rel.' },
    ]));
    const { suggestDependencies } = await import('./dependency-detector-service.js');
    const result = await suggestDependencies('p-1', 'T', '', undefined);
    expect(result[0].relationship).toBe('related');
  });
});
