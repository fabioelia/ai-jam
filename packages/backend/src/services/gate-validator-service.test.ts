import { describe, it, expect, vi, beforeEach } from 'vitest';

let ticketsRow: unknown[] = [];
let notesRows: unknown[] = [];
let commentsRows: unknown[] = [];

vi.mock('../db/connection.js', () => {
  const selects: unknown[][] = [];
  const mock = {
    select: vi.fn(() => ({
      from: vi.fn((_table: unknown) => ({
        where: vi.fn(() => ({
          then: (resolve: (v: unknown[]) => void) => {
            const rows = selects.shift() ?? [];
            return Promise.resolve(rows).then(resolve);
          },
        })),
      })),
    })),
    _selects: selects,
  };
  return { db: mock };
});

vi.mock('../db/schema.js', () => ({
  tickets: { id: 'id', title: 'title', status: 'status', priority: 'priority', description: 'description', projectId: 'projectId' },
  ticketNotes: { ticketId: 'ticketId', handoffFrom: 'handoffFrom', handoffTo: 'handoffTo', content: 'content' },
  comments: { ticketId: 'ticketId', body: 'body' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
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

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    title: 'Implement login form',
    status: 'in_progress',
    priority: 'high',
    description: 'Build login form\n- [ ] Email validation\n- [ ] Submit button',
    projectId: 'p-1',
    ...overrides,
  };
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    ticketId: 't-1',
    handoffFrom: 'agent-a',
    handoffTo: 'agent-b',
    content: 'Completed auth service integration.',
    ...overrides,
  };
}

function makeComment(body = 'LGTM, ready for QA') {
  return { ticketId: 't-1', body };
}

function makeAIResponse(result: object) {
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

function setupDB(db: { _selects: unknown[][] }, rows: unknown[][]) {
  db._selects.length = 0;
  rows.forEach(r => db._selects.push(r));
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  ticketsRow = [];
  notesRows = [];
  commentsRows = [];
  mockCreate.mockReset();
});

describe('validateTicketForTransition', () => {
  it('throws when ticket not found', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[], [], []]);
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    await expect(validateTicketForTransition('t-missing', 'review')).rejects.toThrow('Ticket t-missing not found');
  });

  it('returns valid result from AI JSON response', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    const aiResult = { approved: true, score: 0.9, assessment: 'Ready for review.', gaps: [], checklist: [{ item: 'Email validation', met: true }] };
    mockCreate.mockResolvedValue(makeAIResponse(aiResult));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    const result = await validateTicketForTransition('t-1', 'review');
    expect(result.approved).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.assessment).toBe('Ready for review.');
    expect(result.checklist).toHaveLength(1);
  });

  it('parses AI JSON wrapped in code block', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    const aiResult = { approved: false, score: 0.4, assessment: 'Missing test notes.', gaps: ['No tests documented'], checklist: [] };
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(aiResult) + '\n```' }] });
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    const result = await validateTicketForTransition('t-1', 'qa');
    expect(result.approved).toBe(false);
    expect(result.score).toBe(0.4);
    expect(result.gaps).toContain('No tests documented');
  });

  it('includes handoff notes in prompt context', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [makeNote()], []]);
    const aiResult = { approved: true, score: 0.85, assessment: 'Good.', gaps: [], checklist: [] };
    mockCreate.mockResolvedValue(makeAIResponse(aiResult));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    await validateTicketForTransition('t-1', 'review');
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.messages[0].content).toContain('agent-a → agent-b');
  });

  it('includes recent comments in prompt context', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], [makeComment('All tests passing.')]]);
    const aiResult = { approved: true, score: 0.8, assessment: 'OK.', gaps: [], checklist: [] };
    mockCreate.mockResolvedValue(makeAIResponse(aiResult));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    await validateTicketForTransition('t-1', 'review');
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.messages[0].content).toContain('All tests passing.');
  });

  it('throws when AI returns no JSON', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'I cannot determine readiness.' }] });
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    await expect(validateTicketForTransition('t-1', 'review')).rejects.toThrow('Gate validator returned no JSON');
  });

  it('throws on AI API error', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    mockCreate.mockRejectedValue(new Error('Rate limited'));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    await expect(validateTicketForTransition('t-1', 'review')).rejects.toThrow('Rate limited');
  });

  it('sanitizes malformed AI fields to safe defaults', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    mockCreate.mockResolvedValue(makeAIResponse({ approved: 'yes', score: null, assessment: null, gaps: null, checklist: null }));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    const result = await validateTicketForTransition('t-1', 'review');
    expect(typeof result.approved).toBe('boolean');
    expect(result.score).toBe(0);
    expect(result.assessment).toBe('');
    expect(result.gaps).toEqual([]);
    expect(result.checklist).toEqual([]);
  });

  it('score >= 0.85 signals auto-approve threshold', async () => {
    const { db } = await import('../db/connection.js');
    setupDB(db as never, [[makeTicket()], [], []]);
    const aiResult = { approved: true, score: 0.92, assessment: 'All criteria met.', gaps: [], checklist: [{ item: 'AC1', met: true }] };
    mockCreate.mockResolvedValue(makeAIResponse(aiResult));
    const { validateTicketForTransition } = await import('./gate-validator-service.js');
    const result = await validateTicketForTransition('t-1', 'acceptance');
    expect(result.approved).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.85);
  });
});
