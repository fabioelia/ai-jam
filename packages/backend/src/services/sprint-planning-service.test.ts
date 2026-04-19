import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockTickets: any[] = [];
let aiReturnValue: 'throw' | string | null = null;

// Proxy-based db mock — survives resetModules unlike mockReturnValue chains
vi.mock('../db/connection.js', () => ({
  db: new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (prop === 'select') {
        return () => ({
          from: () => ({
            where: () => Promise.resolve(mockTickets),
          }),
        });
      }
      return () => ({});
    },
  }),
}));

function makeAiMock() {
  return vi.fn().mockImplementation(class MockAnthropic {
    messages = {
      create: vi.fn(async () => {
        if (aiReturnValue === 'throw') throw new Error('network error');
        if (aiReturnValue && typeof aiReturnValue === 'string') {
          return { content: [{ type: 'text', text: aiReturnValue }] };
        }
        return { content: [{ type: 'text', text: '{}' }] };
      }),
    };
    constructor() {}
  });
}

vi.mock('@anthropic-ai/sdk', () => ({ default: makeAiMock() }));

beforeEach(() => {
  vi.resetModules();
  mockTickets = [];
  aiReturnValue = null;
});

function aiJson(obj: Record<string, unknown>) {
  aiReturnValue = JSON.stringify(obj);
}

function aiText(text: string) {
  aiReturnValue = text;
}

describe('generateSprintPlan', () => {
  it('returns fallback when no tickets exist', async () => {
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.recommendedTickets).toEqual([]);
    expect(plan.sprintGoal).toBe('No backlog tickets available for planning');
    expect(plan.estimatedPoints).toBe(0);
    expect(plan.confidence).toBe(0);
  });

  it('returns fallback when backlog is empty (only in_progress/done)', async () => {
    mockTickets = [
      { id: 'T-1', title: 'In Progress', storyPoints: 5, priority: 'high', status: 'in_progress', updatedAt: '2025-01-01' },
      { id: 'T-2', title: 'Done', storyPoints: 3, priority: 'medium', status: 'done', updatedAt: '2025-01-01' },
    ];
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.recommendedTickets).toEqual([]);
    expect(plan.estimatedPoints).toBe(0);
  });

  it('returns fallback when AI client throws', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Backlog', storyPoints: 5, priority: 'high', status: 'backlog', updatedAt: '2025-01-01' },
    ];
    aiReturnValue = 'throw';
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.recommendedTickets).toEqual([]);
    expect(plan.reasoning).toBe('AI service unavailable');
  });

  it('returns fallback when AI response is unparseable', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Backlog', storyPoints: 3, priority: 'high', status: 'backlog', updatedAt: '2025-01-01' },
    ];
    aiText('not json at all');
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.recommendedTickets).toEqual([]);
    expect(plan.reasoning).toBe('AI response could not be parsed');
  });

  it('returns correct structure on successful parse', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Setup CI', storyPoints: 3, priority: 'critical', status: 'backlog', updatedAt: '2025-01-01' },
      { id: 'T-2', title: 'Auth Flow', storyPoints: 5, priority: 'high', status: 'backlog', updatedAt: '2025-01-02' },
      { id: 'T-3', title: 'Done Thing', storyPoints: 8, priority: 'medium', status: 'done', updatedAt: '2025-01-03' },
    ];
    aiJson({
      recommendedTickets: [
        { id: 'T-1', title: 'Setup CI', storyPoints: 3, priority: 'critical', reason: 'Blocker for everything else' },
      ],
      sprintGoal: 'Infrastructure setup',
      estimatedPoints: 3,
      capacityUtilization: 0.375,
      risks: ['Single point of failure'],
      confidence: 0.85,
      reasoning: 'Good data available',
    });
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.recommendedTickets).toHaveLength(1);
    expect(plan.recommendedTickets[0].id).toBe('T-1');
    expect(plan.sprintGoal).toBe('Infrastructure setup');
    expect(plan.risks).toEqual(['Single point of failure']);
    expect(plan.confidence).toBe(0.85);
    expect(plan.reasoning).toBe('Good data available');
  });

  it('returns empty risks when AI provides none', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Backlog', storyPoints: 2, priority: 'low', status: 'backlog', updatedAt: '2025-01-01' },
    ];
    aiJson({
      recommendedTickets: [{ id: 'T-1', title: 'Backlog', storyPoints: 2, priority: 'low', reason: 'Simple' }],
      sprintGoal: 'Small task',
      estimatedPoints: 2,
      capacityUtilization: 0.1,
      risks: [],
      confidence: 0.5,
      reasoning: 'OK',
    });
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    expect(plan.risks).toEqual([]);
  });

  it('calculates velocity from completed tickets', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Backlog', storyPoints: 3, priority: 'high', status: 'backlog', updatedAt: '2025-01-01' },
      { id: 'T-2', title: 'Done A', storyPoints: 8, priority: 'medium', status: 'done', updatedAt: '2025-01-02' },
      { id: 'T-3', title: 'Done B', storyPoints: 4, priority: 'low', status: 'done', updatedAt: '2025-01-03' },
    ];
    aiJson({
      recommendedTickets: [{ id: 'T-1', title: 'Backlog', storyPoints: 3, priority: 'high', reason: 'Priority' }],
      sprintGoal: 'Ship feature',
      estimatedPoints: 3,
      capacityUtilization: 0.5,
      risks: [],
      confidence: 0.7,
      reasoning: 'Reasonable',
    });
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    // velocity = (8 + 4) / 2 = 6, raw = 3/6 = 0.5
    expect(plan.capacityUtilization).toBe(0.5);
  });

  it('clamps capacityUtilization to [0, 2]', async () => {
    mockTickets = [
      { id: 'T-1', title: 'Backlog', storyPoints: 50, priority: 'high', status: 'backlog', updatedAt: '2025-01-01' },
    ];
    aiJson({
      recommendedTickets: [{ id: 'T-1', title: 'Backlog', storyPoints: 50, priority: 'high', reason: 'Must do' }],
      sprintGoal: 'Huge sprint',
      estimatedPoints: 50,
      capacityUtilization: 2.5,
      risks: [],
      confidence: 0.6,
      reasoning: 'Over capacity',
    });
    const { generateSprintPlan } = await import('./sprint-planning-service.js');
    const plan = await generateSprintPlan('proj-1');
    // velocity = 20 (no done tickets), raw = 50/20 = 2.5, clamped = 2
    expect(plan.capacityUtilization).toBe(2);
  });
});
