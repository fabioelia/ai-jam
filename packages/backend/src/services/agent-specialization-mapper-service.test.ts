import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapAgentSpecializations } from './agent-specialization-mapper-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '[{"agent":"A","recommendation":"Route feature tickets to A."}]' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';

function makeSelect(rows: object[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function ticket(
  id: string,
  status: string,
  persona: string | null,
  labels: string[] = [],
  createdAt = new Date(0),
  updatedAt = new Date(3_600_000),
) {
  return { id, status, assignedPersona: persona, labels, createdAt, updatedAt };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mapAgentSpecializations', () => {
  it('returns empty agentProfiles when no tickets exist', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelect([]) as any);
    const report = await mapAgentSpecializations('proj-1');
    expect(report.agentProfiles).toHaveLength(0);
    expect(report.totalAgents).toBe(0);
    expect(report.topLabel).toBeNull();
  });

  it('agent with no completed tickets appears as generalist with totalCompleted=0', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelect([ticket('t1', 'in_progress', 'AgentA', ['bug'])]) as any,
    );
    const report = await mapAgentSpecializations('proj-1');
    const profile = report.agentProfiles.find((p) => p.agentPersona === 'AgentA');
    expect(profile).toBeDefined();
    expect(profile!.totalCompleted).toBe(0);
    expect(profile!.specializationStrength).toBe('generalist');
  });

  it('assigns strong when top label >= 50% of completed tickets', async () => {
    const rows = [
      ticket('t1', 'done', 'AgentA', ['bug']),
      ticket('t2', 'done', 'AgentA', ['bug']),
      ticket('t3', 'done', 'AgentA', ['bug']),
      ticket('t4', 'done', 'AgentA', ['feature']),
    ];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows) as any);
    const report = await mapAgentSpecializations('proj-1');
    const profile = report.agentProfiles[0];
    expect(profile.specializationStrength).toBe('strong');
    expect(profile.topLabels[0]).toBe('bug');
  });

  it('assigns moderate when top label 25-49%', async () => {
    const rows = [
      ticket('t1', 'done', 'AgentA', ['bug']),
      ticket('t2', 'done', 'AgentA', ['feature']),
      ticket('t3', 'done', 'AgentA', ['feature']),
      ticket('t4', 'done', 'AgentA', ['feature']),
    ];
    // feature = 3/4 = 75% → strong. Use 1 feature / 4 total labeled = 25% → moderate boundary
    const rows2 = [
      ticket('t1', 'done', 'AgentA', ['feature']),
      ticket('t2', 'done', 'AgentA', ['bug']),
      ticket('t3', 'done', 'AgentA', ['chore']),
      ticket('t4', 'done', 'AgentA', ['design']),
    ];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows2) as any);
    const report = await mapAgentSpecializations('proj-1');
    const profile = report.agentProfiles[0];
    expect(profile.specializationStrength).toBe('moderate');
  });

  it('assigns generalist when top label < 25% or all unlabeled', async () => {
    const rows = [
      ticket('t1', 'done', 'AgentA', []),
      ticket('t2', 'done', 'AgentA', []),
    ];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows) as any);
    const report = await mapAgentSpecializations('proj-1');
    const profile = report.agentProfiles[0];
    expect(profile.specializationStrength).toBe('generalist');
  });

  it('computes avgCompletionTimeMs correctly', async () => {
    const created = new Date('2024-01-01T00:00:00Z');
    const updated = new Date('2024-01-01T02:00:00Z'); // 2h = 7_200_000ms
    const rows = [
      { id: 't1', status: 'done', assignedPersona: 'AgentA', labels: [], createdAt: created, updatedAt: updated },
      { id: 't2', status: 'done', assignedPersona: 'AgentA', labels: [], createdAt: created, updatedAt: updated },
    ];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows) as any);
    const report = await mapAgentSpecializations('proj-1');
    expect(report.agentProfiles[0].avgCompletionTimeMs).toBe(7_200_000);
  });

  it('sorts strong before moderate before generalist', async () => {
    const rows = [
      // generalist: all unlabeled
      ticket('t1', 'done', 'Generalist', []),
      // moderate: 1/4 = 25%
      ticket('t2', 'done', 'Moderate', ['a']),
      ticket('t3', 'done', 'Moderate', ['b']),
      ticket('t4', 'done', 'Moderate', ['c']),
      ticket('t5', 'done', 'Moderate', ['d']),
      // strong: 3/4 = 75%
      ticket('t6', 'done', 'Strong', ['bug']),
      ticket('t7', 'done', 'Strong', ['bug']),
      ticket('t8', 'done', 'Strong', ['bug']),
      ticket('t9', 'done', 'Strong', ['feature']),
    ];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows) as any);
    const report = await mapAgentSpecializations('proj-1');
    const strengths = report.agentProfiles.map((p) => p.specializationStrength);
    expect(strengths[0]).toBe('strong');
    expect(strengths[strengths.length - 1]).toBe('generalist');
  });

  it('uses fallback recommendation on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI error')),
      },
    }) as any);

    const rows = [ticket('t1', 'done', 'AgentA', ['bug'])];
    vi.mocked(db.select).mockReturnValue(makeSelect(rows) as any);
    const report = await mapAgentSpecializations('proj-1');
    expect(report.agentProfiles[0].recommendation).toBe(
      'Route tickets matching agent history for best performance.',
    );
  });
});
