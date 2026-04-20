import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeSpecializationDrift, inferSpecialization, inferTicketType } from './agent-specialization-drift-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","aiRecommendations":["r1"]}' }] }) },
    };
  }),
}));

import { db } from '../db/connection.js';

function makeTicket(
  assignedPersona: string | null,
  status: string,
  title: string,
  description: string = '',
) {
  return {
    id: Math.random().toString(),
    title,
    description,
    status,
    assignedPersona,
  };
}

function mockDbSelect(ticketList: ReturnType<typeof makeTicket>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(ticketList),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeSpecializationDrift', () => {
  it('returns empty report for project with no assigned tickets', async () => {
    mockDbSelect([]);
    const report = await analyzeSpecializationDrift('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.systemAvgAlignmentPct).toBe(0);
    expect(report.mostAlignedAgent).toBeNull();
    expect(report.mostDriftedAgent).toBeNull();
  });

  it('inferSpecialization classifies personas correctly', () => {
    expect(inferSpecialization('ai-jam-developer')).toBe('engineering');
    expect(inferSpecialization('ai-jam-qa')).toBe('quality');
    expect(inferSpecialization('ai-jam-product')).toBe('product');
    expect(inferSpecialization('unknown')).toBe('general');
  });

  it('inferTicketType classifies ticket types correctly', () => {
    expect(inferTicketType({ title: 'Fix backend API endpoint' })).toBe('engineering');
    expect(inferTicketType({ title: 'Run QA verification' })).toBe('quality');
    expect(inferTicketType({ title: 'Update UI mockup' })).toBe('design');
    expect(inferTicketType({ title: 'Team sync meeting' })).toBe('general');
  });

  it('agent with all in-spec tickets has driftScore=0 and driftLevel=aligned', async () => {
    mockDbSelect([
      makeTicket('ai-jam-developer', 'in_progress', 'Fix backend API endpoint'),
      makeTicket('ai-jam-developer', 'done', 'Update database schema'),
      makeTicket('ai-jam-developer', 'review', 'Add new API endpoint'),
    ]);
    const report = await analyzeSpecializationDrift('proj-1');
    const agent = report.agents.find((a) => a.personaId === 'ai-jam-developer');
    expect(agent).toBeDefined();
    expect(agent!.driftScore).toBe(0);
    expect(agent!.driftLevel).toBe('aligned');
    expect(agent!.specializationAlignmentPct).toBe(100);
  });

  it('agent with 50% in-spec tickets has driftScore=50 and driftLevel=significant_drift', async () => {
    mockDbSelect([
      makeTicket('ai-jam-developer', 'in_progress', 'Fix backend API endpoint'),
      makeTicket('ai-jam-developer', 'done', 'Fix backend API endpoint'),
      makeTicket('ai-jam-developer', 'review', 'Team sync meeting'),
      makeTicket('ai-jam-developer', 'qa', 'Team sync meeting'),
    ]);
    const report = await analyzeSpecializationDrift('proj-1');
    const agent = report.agents.find((a) => a.personaId === 'ai-jam-developer');
    expect(agent).toBeDefined();
    expect(agent!.driftScore).toBe(50);
    expect(agent!.driftLevel).toBe('significant_drift');
  });

  it('driftLevel thresholds map correctly', async () => {
    // Test via inferring: aligned < 20, minor_drift < 40, significant_drift < 60, off_track >= 60
    // We'll test by constructing agents with known driftScores via ticket ratios
    // aligned: driftScore=15 → 17/20 in-spec tickets (85%)
    // minor_drift: driftScore=30 → 14/20 in-spec (70%)
    // significant_drift: driftScore=50 → 10/20 in-spec (50%)
    // off_track: driftScore=70 → 6/20 in-spec (30%)

    // Use 4 different personas with known splits
    const engineeringTitles = ['Fix backend API endpoint', 'Update database schema', 'Add server migration', 'Fix server endpoint'];
    const generalTitles = ['Team sync meeting', 'Random unrelated task'];

    // aligned persona: 17 eng, 3 general → 85% alignment, drift=15
    const alignedTickets = [
      ...Array(17).fill(null).map(() => makeTicket('developer-aligned', 'done', 'Fix backend API endpoint')),
      ...Array(3).fill(null).map(() => makeTicket('developer-aligned', 'done', 'Team sync meeting')),
    ];

    // minor_drift: 14 eng, 6 general → 70% alignment, drift=30
    const minorDriftTickets = [
      ...Array(14).fill(null).map(() => makeTicket('developer-minor', 'done', 'Fix backend API endpoint')),
      ...Array(6).fill(null).map(() => makeTicket('developer-minor', 'done', 'Team sync meeting')),
    ];

    // significant_drift: 10 eng, 10 general → 50% alignment, drift=50
    const sigDriftTickets = [
      ...Array(10).fill(null).map(() => makeTicket('developer-sig', 'done', 'Fix backend API endpoint')),
      ...Array(10).fill(null).map(() => makeTicket('developer-sig', 'done', 'Team sync meeting')),
    ];

    // off_track: 6 eng, 14 general → 30% alignment, drift=70
    const offTrackTickets = [
      ...Array(6).fill(null).map(() => makeTicket('developer-off', 'done', 'Fix backend API endpoint')),
      ...Array(14).fill(null).map(() => makeTicket('developer-off', 'done', 'Team sync meeting')),
    ];

    mockDbSelect([...alignedTickets, ...minorDriftTickets, ...sigDriftTickets, ...offTrackTickets]);
    const report = await analyzeSpecializationDrift('proj-1');

    const aligned = report.agents.find((a) => a.personaId === 'developer-aligned');
    const minor = report.agents.find((a) => a.personaId === 'developer-minor');
    const sig = report.agents.find((a) => a.personaId === 'developer-sig');
    const off = report.agents.find((a) => a.personaId === 'developer-off');

    expect(aligned!.driftLevel).toBe('aligned');
    expect(minor!.driftLevel).toBe('minor_drift');
    expect(sig!.driftLevel).toBe('significant_drift');
    expect(off!.driftLevel).toBe('off_track');
  });

  it('mostAlignedAgent is the persona with highest alignment and mostDriftedAgent is lowest', async () => {
    mockDbSelect([
      // developer-high: 3/3 in-spec (100%)
      makeTicket('developer-high', 'done', 'Fix backend API endpoint'),
      makeTicket('developer-high', 'done', 'Update database schema'),
      makeTicket('developer-high', 'done', 'Add server migration'),
      // developer-low: 1/3 in-spec (~33%)
      makeTicket('developer-low', 'done', 'Fix backend API endpoint'),
      makeTicket('developer-low', 'done', 'Team sync meeting'),
      makeTicket('developer-low', 'done', 'Team sync meeting'),
    ]);
    const report = await analyzeSpecializationDrift('proj-1');
    expect(report.mostAlignedAgent).toBe('developer-high');
    expect(report.mostDriftedAgent).toBe('developer-low');
  });

  it('returns fallback summary and recommendations on AI error', async () => {
    const { default: AnthropicMock } = await import('@anthropic-ai/sdk');
    (AnthropicMock as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
        },
      };
    });

    mockDbSelect([
      makeTicket('ai-jam-developer', 'in_progress', 'Fix backend API endpoint'),
    ]);

    const report = await analyzeSpecializationDrift('proj-fallback');
    expect(report.aiSummary).toBe('Unable to generate AI analysis. Review agent specialization alignment manually.');
    expect(report.aiRecommendations).toEqual([
      'Audit task assignments to ensure agents work within their specializations.',
      'Consider adding routing rules to direct tickets to the most appropriate persona.',
      'Review personas with high drift scores for potential role clarification.',
    ]);
  });
});
