import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentConfidenceCalibration,
  buildCalibrationProfiles,
  getConfidenceSignal,
  computeCalibrationLevel,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type NoteRow,
  type SessionRow,
} from './agent-confidence-calibration-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI calibration summary.',
        recommendations: ['Improve confidence tracking.'],
      }),
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { db } from '../db/connection.js';

function makeTicket(
  id: string,
  assignedPersona: string,
  status: string,
  createdAt = new Date('2026-01-01T00:00:00Z'),
  updatedAt = new Date('2026-01-02T00:00:00Z'),
): TicketRow {
  return { id, assignedPersona, status, createdAt, updatedAt };
}

function makeNote(
  ticketId: string,
  handoffFrom: string | null,
  handoffTo: string | null,
  content: string,
  createdAt = new Date('2026-01-01T12:00:00Z'),
): NoteRow {
  return { ticketId, handoffFrom, handoffTo, content, createdAt };
}

function makeSession(
  id: string,
  ticketId: string | null,
  personaType: string,
  status: string,
  startedAt = new Date('2026-01-01T01:00:00Z'),
  completedAt: Date | null = null,
): SessionRow {
  return { id, ticketId, personaType, status, startedAt, completedAt };
}

function mockDb(tickets: TicketRow[], notes: NoteRow[], sessions: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      if (callCount === 2) return Promise.resolve(notes);
      return Promise.resolve(sessions);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty agents array
it('returns empty agents array for project with no tickets', async () => {
  mockDb([], [], []);
  const report = await analyzeAgentConfidenceCalibration('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.avgCalibrationScore).toBe(0);
  expect(report.bestCalibratedAgent).toBeNull();
  expect(report.mostOverconfidentAgent).toBeNull();
  expect(report.mostUnderconfidentAgent).toBeNull();
  expect(report.systemCalibrationGap).toBe(0);
});

// Test 2: overconfident agent — high confidence signals with failure outcomes → high overconfidenceRate
it('detects overconfident agent with high confidence signals and failure outcomes', () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'in_progress'),
    makeTicket('t2', 'AgentA', 'in_progress'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentA', null, 'I am confident this is done and verified'),
    makeNote('t2', 'AgentA', null, 'definitely complete and confirmed'),
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentA', 'failed'),
    makeSession('s2', 't2', 'AgentA', 'failed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  const agentA = profiles.find((p) => p.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  expect(agentA!.overconfidenceRate).toBeGreaterThan(0);
});

// Test 3: underconfident agent — low confidence signals with success outcomes → high underconfidenceRate
it('detects underconfident agent with low confidence signals and success outcomes', () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentB', 'done'),
    makeTicket('t2', 'AgentB', 'done'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentB', null, 'uncertain about this, maybe needs review'),
    makeNote('t2', 'AgentB', null, 'unclear if this works, might be blocked'),
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentB', 'completed'),
    makeSession('s2', 't2', 'AgentB', 'completed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  const agentB = profiles.find((p) => p.personaId === 'AgentB');
  expect(agentB).toBeDefined();
  expect(agentB!.underconfidenceRate).toBeGreaterThan(0);
});

// Test 4: well-calibrated agent — calibrationScore >= 80
it('assigns excellent calibration to well-calibrated agent', () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentC', 'done'),
    makeTicket('t2', 'AgentC', 'done'),
    makeTicket('t3', 'AgentC', 'done'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentC', 'AgentD', 'confident this is verified and done'),
    makeNote('t2', 'AgentC', 'AgentD', 'definitely complete'),
    makeNote('t3', 'AgentC', 'AgentD', 'confirmed and verified'),
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentC', 'completed'),
    makeSession('s2', 't2', 'AgentC', 'completed'),
    makeSession('s3', 't3', 'AgentC', 'completed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  const agentC = profiles.find((p) => p.personaId === 'AgentC');
  expect(agentC).toBeDefined();
  expect(agentC!.calibrationScore).toBeGreaterThanOrEqual(80);
  expect(agentC!.calibrationLevel).toBe('excellent');
});

// Test 5: calibration gap calculation — abs(avgConfidenceLevel - avgOutcomeSuccessRate) correct
it('calculates calibration gap as abs(avgConfidenceLevel - avgOutcomeSuccessRate)', () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentD', 'in_progress'),
    makeTicket('t2', 'AgentD', 'in_progress'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentD', null, 'confident and done'), // high → score 80
    makeNote('t2', 'AgentD', null, 'confident and done'), // high → score 80
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentD', 'failed'),
    makeSession('s2', 't2', 'AgentD', 'failed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  const agentD = profiles.find((p) => p.personaId === 'AgentD');
  expect(agentD).toBeDefined();
  // avgConfidenceLevel = 80, avgOutcomeSuccessRate = 0, gap = 80
  expect(agentD!.calibrationGap).toBe(80);
  expect(agentD!.avgConfidenceLevel).toBe(80);
  expect(agentD!.avgOutcomeSuccessRate).toBe(0);
});

// Test 6: mixed signals — multiple agents with varied outcomes
it('handles multiple agents with mixed confidence signals and outcomes', () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentE', 'done'),
    makeTicket('t2', 'AgentF', 'in_progress'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentE', null, 'confident and verified'),
    makeNote('t2', 'AgentF', null, 'uncertain and possibly blocked'),
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentE', 'completed'),
    makeSession('s2', 't2', 'AgentF', 'failed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  expect(profiles.length).toBe(2);
  const agentE = profiles.find((p) => p.personaId === 'AgentE');
  const agentF = profiles.find((p) => p.personaId === 'AgentF');
  expect(agentE).toBeDefined();
  expect(agentF).toBeDefined();
  // AgentE: high confidence + success → low overconfidence, well-calibrated
  expect(agentE!.overconfidenceRate).toBe(0);
  // AgentF: low confidence + failure → underconfidenceRate 0 (failed, not success)
  expect(agentF!.underconfidenceRate).toBe(0);
});

// Test 7: AI summary fallback — when OpenRouter fails, uses static fallback
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI error'));
  mockDb([], [], []);
  const report = await analyzeAgentConfidenceCalibration('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});

// Test 8: boundary score values — calibrationScore capped at 100, not negative
it('caps calibrationScore at 100 and keeps it non-negative', () => {
  // Perfect case: high confidence + success → should score near 100
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentG', 'done'),
  ];
  const noteList: NoteRow[] = [
    makeNote('t1', 'AgentG', 'AgentH', 'confident, verified, and definitely complete'),
  ];
  const sessionList: SessionRow[] = [
    makeSession('s1', 't1', 'AgentG', 'completed'),
  ];
  const profiles = buildCalibrationProfiles(ticketList, noteList, sessionList);
  const agentG = profiles.find((p) => p.personaId === 'AgentG');
  expect(agentG).toBeDefined();
  expect(agentG!.calibrationScore).toBeLessThanOrEqual(100);
  expect(agentG!.calibrationScore).toBeGreaterThanOrEqual(0);

  // Worst case: high confidence + all failures → score should still be >= 0
  const ticketList2: TicketRow[] = [
    makeTicket('t2', 'AgentH', 'in_progress'),
    makeTicket('t3', 'AgentH', 'in_progress'),
    makeTicket('t4', 'AgentH', 'in_progress'),
  ];
  const noteList2: NoteRow[] = [
    makeNote('t2', 'AgentH', null, 'confident, certain, definitely done'),
    makeNote('t3', 'AgentH', null, 'verified and confirmed'),
    makeNote('t4', 'AgentH', null, 'definitely complete'),
  ];
  const sessionList2: SessionRow[] = [
    makeSession('s2', 't2', 'AgentH', 'failed'),
    makeSession('s3', 't3', 'AgentH', 'failed'),
    makeSession('s4', 't4', 'AgentH', 'failed'),
  ];
  const profiles2 = buildCalibrationProfiles(ticketList2, noteList2, sessionList2);
  const agentH = profiles2.find((p) => p.personaId === 'AgentH');
  expect(agentH).toBeDefined();
  expect(agentH!.calibrationScore).toBeLessThanOrEqual(100);
  expect(agentH!.calibrationScore).toBeGreaterThanOrEqual(0);
});
