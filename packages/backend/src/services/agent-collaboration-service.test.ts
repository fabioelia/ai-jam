import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectSpecializations, scoreCollaborationPair, analyzeCollaboration } from './agent-collaboration-service.js';

vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI generated collaboration rationale' }],
      }),
    },
  })),
}));

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  } as unknown;
}

function makeSelectDistinctChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(data),
      }),
    }),
  } as unknown;
}

async function setupDb(tickets: unknown[], agents: unknown[]) {
  const { db } = await import('../db/connection.js');
  vi.mocked(db.select).mockReturnValue(makeSelectChain(tickets) as ReturnType<typeof db.select>);
  vi.mocked(db.selectDistinct).mockReturnValue(makeSelectDistinctChain(agents) as ReturnType<typeof db.selectDistinct>);
}

describe('agent-collaboration-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty complexTickets when no eligible tickets', async () => {
    await setupDb([], []);
    const report = await analyzeCollaboration('project-1');
    expect(report.complexTickets).toHaveLength(0);
    expect(report.projectId).toBe('project-1');
  });

  it('detects security specialization from auth keyword', () => {
    const specs = detectSpecializations('implement auth token validation');
    expect(specs).toContain('security');
  });

  it('detects frontend specialization from modal keyword', () => {
    const specs = detectSpecializations('build confirmation modal component');
    expect(specs).toContain('frontend');
  });

  it('skips tickets with fewer than 2 specializations', async () => {
    const singleSpecTicket = {
      id: 'ticket-1',
      title: 'Update database schema',
      description: 'Add new columns to users table for profile information storage',
      priority: 'high',
      status: 'backlog',
    };
    await setupDb([singleSpecTicket], [{ name: 'agent-alpha' }, { name: 'agent-beta' }]);
    const report = await analyzeCollaboration('project-1');
    expect(report.complexTickets).toHaveLength(0);
  });

  it('scores complementary agent pairs higher than duplicate-skill pairs', () => {
    // security-agent vs frontend-agent = complementary
    const complementaryScore = scoreCollaborationPair('security-auth-agent', 'frontend-ui-agent', ['security', 'frontend']);
    // Two security agents = duplicate skill
    const duplicateScore = scoreCollaborationPair('security-auth-agent', 'security-token-agent', ['security', 'frontend']);
    expect(complementaryScore).toBeGreaterThan(duplicateScore);
  });

  it('returns top-2 pairs ordered by collaboration score descending', async () => {
    const multiSpecTicket = {
      id: 'ticket-2',
      title: 'Build auth modal component with backend API',
      description: 'Create a security-focused frontend modal that integrates with the backend API endpoint for user authentication',
      priority: 'high',
      status: 'in_progress',
    };
    await setupDb(
      [multiSpecTicket],
      [{ name: 'security-auth-agent' }, { name: 'frontend-ui-agent' }, { name: 'backend-api-agent' }],
    );
    const report = await analyzeCollaboration('project-1');
    expect(report.complexTickets).toHaveLength(1);
    const pairs = report.complexTickets[0].recommendedPairs;
    expect(pairs).toHaveLength(2);
    expect(pairs[0].collaborationScore).toBeGreaterThanOrEqual(pairs[1].collaborationScore);
  });

  it('skips done tickets', async () => {
    const doneTicket = {
      id: 'ticket-3',
      title: 'Fix auth token security and frontend modal component',
      description: 'Critical security fix for authentication token validation in the frontend modal interface with backend API',
      priority: 'critical',
      status: 'done',
    };
    const activeTicket = {
      id: 'ticket-4',
      title: 'Simple task',
      description: 'Short desc',
      priority: 'low',
      status: 'backlog',
    };
    await setupDb([doneTicket, activeTicket], [{ name: 'agent-alpha' }, { name: 'agent-beta' }]);
    const report = await analyzeCollaboration('project-1');
    const ids = report.complexTickets.map((t) => t.ticketId);
    expect(ids).not.toContain('ticket-3');
  });

  it('falls back to heuristic rationale on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    vi.mocked(Anthropic).mockImplementationOnce(
      () =>
        ({
          messages: {
            create: vi.fn().mockRejectedValue(new Error('API unavailable')),
          },
        }) as unknown as InstanceType<typeof Anthropic>,
    );

    const complexTicket = {
      id: 'ticket-5',
      title: 'Implement auth token security for frontend modal component',
      description: 'Security-critical feature requiring auth token validation integrated with the frontend modal UI component',
      priority: 'critical',
      status: 'backlog',
    };
    await setupDb([complexTicket], [{ name: 'agent-alpha' }, { name: 'agent-beta' }]);
    const report = await analyzeCollaboration('project-1');
    expect(report.complexTickets).toHaveLength(1);
    const rationale = report.complexTickets[0].recommendedPairs[0].rationale;
    expect(rationale).toMatch(/leads|covers/);
  });
});
