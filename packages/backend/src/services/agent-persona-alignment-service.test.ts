import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentPersonaAlignment } from './agent-persona-alignment-service.js';

// Mock DB
vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

// CRITICAL: use `function` keyword for Anthropic mock (arrow function causes "not a constructor" error)
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","aiRecommendations":["r1"]}' }] }) },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

function makeTicket(
  id: string,
  assignedPersona: string | null,
  title: string,
  status: string = 'in_progress',
  description: string = '',
) {
  return { id, title, description, status, assignedPersona };
}

function makeNote(
  id: string,
  ticketId: string,
  handoffFrom: string | null,
  handoffTo: string | null,
) {
  return { id, ticketId, authorId: 'agent', handoffFrom, handoffTo };
}

// Build a chainable mock for db.select().from().where()
function mockDbSelectSequence(tickets: ReturnType<typeof makeTicket>[], notes: ReturnType<typeof makeNote>[]) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const idx = callCount++;
    const result = idx === 0 ? tickets : notes;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentPersonaAlignment', () => {
  it('returns empty report for project with no tickets', async () => {
    mockDbSelectSequence([], []);
    const report = await analyzeAgentPersonaAlignment('proj-empty');
    expect(report.agents).toHaveLength(0);
    expect(report.avgAlignmentScore).toBe(0);
    expect(report.mostAligned).toBeNull();
    expect(report.mostDrifted).toBeNull();
  });

  it('computes high alignment for developer with coding tickets and expected handoffs', async () => {
    const t1 = makeTicket('t1', 'developer', 'implement login feature', 'done', 'build oauth integration');
    const t2 = makeTicket('t2', 'developer', 'fix authentication bug', 'done', 'code review needed');
    const n1 = makeNote('n1', 't1', 'developer', 'qa');
    mockDbSelectSequence([t1, t2], [n1]);

    const report = await analyzeAgentPersonaAlignment('proj-1');
    const dev = report.agents.find((a) => a.personaId === 'developer');
    expect(dev).toBeDefined();
    expect(dev!.primaryTaskRate).toBeGreaterThan(50);
    expect(dev!.alignmentScore).toBeGreaterThanOrEqual(60);
    expect(['exemplary', 'aligned']).toContain(dev!.alignmentLevel);
  });

  it('detects cross-persona drift when unexpected handoffs occur', async () => {
    const t1 = makeTicket('t1', 'developer', 'implement feature', 'in_progress');
    // developer handing off to researcher is unexpected
    const n1 = makeNote('n1', 't1', 'developer', 'researcher');
    const n2 = makeNote('n2', 't1', 'developer', 'researcher');
    mockDbSelectSequence([t1], [n1, n2]);

    const report = await analyzeAgentPersonaAlignment('proj-2');
    const dev = report.agents.find((a) => a.personaId === 'developer');
    expect(dev).toBeDefined();
    expect(dev!.crossPersonaHandoffRate).toBeGreaterThan(0);
  });

  it('counts role violations for tickets with 0 persona keywords and ≥2 keywords of a different persona', async () => {
    // qa agent assigned ticket with design keywords (not qa keywords)
    const t1 = makeTicket('t1', 'qa', 'ui layout style component', 'in_progress', 'ux design work');
    mockDbSelectSequence([t1], []);

    const report = await analyzeAgentPersonaAlignment('proj-3');
    const qa = report.agents.find((a) => a.personaId === 'qa');
    expect(qa).toBeDefined();
    expect(qa!.roleViolationCount).toBeGreaterThanOrEqual(1);
  });

  it('computes specialization index based on status distribution', async () => {
    // All tickets in one status = max specialization (100)
    const tickets = [
      makeTicket('t1', 'developer', 'implement A', 'done'),
      makeTicket('t2', 'developer', 'implement B', 'done'),
      makeTicket('t3', 'developer', 'implement C', 'done'),
    ];
    mockDbSelectSequence(tickets, []);

    const report = await analyzeAgentPersonaAlignment('proj-4');
    const dev = report.agents.find((a) => a.personaId === 'developer');
    expect(dev).toBeDefined();
    expect(dev!.specializationIndex).toBe(100);
  });

  it('ranks mixed agents correctly — most aligned first', async () => {
    // Developer: all coding tickets, expected handoffs → high score
    // researcher: no matching tickets, unexpected handoffs → low score
    const tickets = [
      makeTicket('t1', 'developer', 'implement login', 'done', 'code and build'),
      makeTicket('t2', 'developer', 'fix bug', 'done', 'refactor code'),
      makeTicket('t3', 'researcher', 'ui layout style component', 'in_progress', 'design ux'),
    ];
    const notes = [
      makeNote('n1', 't1', 'developer', 'qa'),
      makeNote('n2', 't3', 'researcher', 'designer'),
    ];
    mockDbSelectSequence(tickets, notes);

    const report = await analyzeAgentPersonaAlignment('proj-5');
    expect(report.agents.length).toBeGreaterThanOrEqual(2);
    // Most aligned should come first
    expect(report.agents[0].alignmentScore).toBeGreaterThanOrEqual(
      report.agents[report.agents.length - 1].alignmentScore,
    );
    expect(report.mostAligned).toBe(report.agents[0].personaId);
    expect(report.mostDrifted).toBe(report.agents[report.agents.length - 1].personaId);
  });

  it('falls back to default summary on AI error', async () => {
    const AnthropicMock = vi.mocked(Anthropic);
    AnthropicMock.mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockRejectedValue(new Error('AI API error')),
        },
      } as unknown as InstanceType<typeof Anthropic>;
    });

    const t1 = makeTicket('t1', 'developer', 'implement feature', 'done');
    mockDbSelectSequence([t1], []);

    const report = await analyzeAgentPersonaAlignment('proj-6');
    expect(report.aiSummary).toBe('Agent persona alignment analysis complete.');
    expect(report.aiRecommendations.length).toBeGreaterThan(0);
  });

  it('handles boundary: single agent with all 6 statuses gives specializationIndex 0', async () => {
    const tickets = [
      makeTicket('t1', 'developer', 'implement A', 'backlog'),
      makeTicket('t2', 'developer', 'implement B', 'in_progress'),
      makeTicket('t3', 'developer', 'implement C', 'review'),
      makeTicket('t4', 'developer', 'implement D', 'qa'),
      makeTicket('t5', 'developer', 'implement E', 'acceptance'),
      makeTicket('t6', 'developer', 'implement F', 'done'),
    ];
    mockDbSelectSequence(tickets, []);

    const report = await analyzeAgentPersonaAlignment('proj-7');
    const dev = report.agents.find((a) => a.personaId === 'developer');
    expect(dev).toBeDefined();
    expect(dev!.specializationIndex).toBe(0);
  });

  it('default persona (no keyword match) always has 100% primaryTaskRate', async () => {
    const tickets = [
      makeTicket('t1', 'scrum-master', 'some random task', 'in_progress', 'no specific keywords'),
      makeTicket('t2', 'scrum-master', 'another task', 'done', 'plain description'),
    ];
    mockDbSelectSequence(tickets, []);

    const report = await analyzeAgentPersonaAlignment('proj-8');
    const agent = report.agents.find((a) => a.personaId === 'scrum-master');
    expect(agent).toBeDefined();
    expect(agent!.primaryTaskRate).toBe(100);
  });
});
