import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeContextRetention,
  buildProfiles,
  retentionCategory,
  computeRetentionScore,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type NoteRow,
} from './agent-context-retention-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ summary: 'AI context summary.', recommendations: ['Improve handoff notes.'] }) }],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

const NOW = new Date('2026-04-20T00:00:00Z');

function makeNote(
  ticketId: string,
  authorId: string,
  content: string,
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
  offsetMs = 0,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content,
    handoffFrom,
    handoffTo,
    createdAt: new Date(NOW.getTime() + offsetMs),
  };
}

function mockDb(tickets: { id: string; assignedPersona: string | null }[], notes: NoteRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      return Promise.resolve(notes);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty report when no handoffs
it('returns empty report when no handoffs', async () => {
  mockDb([{ id: 't1', assignedPersona: 'AgentA' }], []);
  const report = await analyzeContextRetention('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.avgRetentionScore).toBe(0);
  expect(report.bestRetainer).toBeNull();
  expect(report.worstRetainer).toBeNull();
  expect(report.systemContextLossRate).toBe(0);
});

// Test 2: utilization rate from keyword overlap
it('computes utilization rate from keyword overlap', () => {
  const notes: NoteRow[] = [
    makeNote('t1', 'Owner', 'handoff note: please investigate authentication failure token expired', 'AgentB', null, 0),
    makeNote('t1', 'AgentB', 'I reviewed the existing authentication failure token expired issue and traced root cause to misconfiguration in the server settings which has now been resolved', null, null, 1000),
  ];
  const { profiles } = buildProfiles(notes);
  const agentB = profiles.find(p => p.personaId === 'AgentB');
  expect(agentB).toBeDefined();
  // AgentB referenced keywords from prior note → utilization > 0
  expect(agentB!.avgContextUtilizationRate).toBeGreaterThan(0);
});

// Test 3: detects context loss (duplicate notes)
it('detects context loss when agent first note duplicates prior note', () => {
  const priorContent = 'please check authentication module verify token expiration logic immediately';
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', priorContent, 'AgentB', null, 0),
    // AgentB copies the prior note almost verbatim
    makeNote('t1', 'AgentB', priorContent, null, null, 1000),
  ];
  const { profiles, totalLosses } = buildProfiles(notes);
  const agentB = profiles.find(p => p.personaId === 'AgentB');
  expect(agentB!.contextLossCount).toBeGreaterThan(0);
  expect(totalLosses).toBeGreaterThan(0);
});

// Test 4: detects redundant work (ticket regression / re-handoff)
it('detects redundant work when same agent receives ticket multiple times', () => {
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'first handoff to AgentB', 'AgentB', null, 0),
    makeNote('t1', 'AgentB', 'partial work done', null, null, 1000),
    // Ticket handed back to AgentB again (re-handoff = regression)
    makeNote('t1', 'AgentA', 'second handoff to AgentB', 'AgentB', null, 2000),
  ];
  const { profiles } = buildProfiles(notes);
  const agentB = profiles.find(p => p.personaId === 'AgentB');
  expect(agentB!.redundantWorkCount).toBeGreaterThan(0);
});

// Test 5: assigns retention categories correctly
it('assigns retention categories based on score thresholds', () => {
  expect(retentionCategory(85)).toBe('excellent');  // ≥80
  expect(retentionCategory(70)).toBe('good');        // ≥60
  expect(retentionCategory(50)).toBe('fair');        // ≥40
  expect(retentionCategory(30)).toBe('poor');        // <40
  // Score formula: util*50 + (1-loss)*30 + (1-redundancy)*20
  expect(computeRetentionScore(1, 0, 0)).toBe(100); // perfect
  expect(computeRetentionScore(0, 1, 1)).toBe(0);   // worst
});

// Test 6: best/worst retainer identified
it('identifies bestRetainer and worstRetainer correctly', () => {
  const priorContent = 'investigate the database connection pool timeout error configuration';
  // AgentA: rich response referencing keywords, long enough to avoid duplicate detection
  const agentANote = 'I reviewed the existing error reports and traced database connection pool timeout issues back to misconfigured settings; the fix has been applied and verified in staging environment successfully';
  // AgentB: copies prior note verbatim → context loss
  const notes: NoteRow[] = [
    makeNote('t1', 'Owner', priorContent, 'AgentA', null, 0),
    makeNote('t1', 'AgentA', agentANote, null, null, 1000),
    makeNote('t2', 'Owner', priorContent, 'AgentB', null, 0),
    makeNote('t2', 'AgentB', priorContent, null, null, 1000),
  ];
  const { profiles } = buildProfiles(notes);
  // AgentA: good utilization, no context loss → higher score
  // AgentB: context loss → lower score
  const agentAScore = profiles.find(p => p.personaId === 'AgentA')!;
  const agentBScore = profiles.find(p => p.personaId === 'AgentB')!;
  expect(agentAScore.retentionScore).toBeGreaterThan(agentBScore.retentionScore);
  expect(profiles[0].personaId).toBe('AgentA');
});

// Test 7: systemContextLossRate across all handoffs
it('computes systemContextLossRate as percentage of handoffs with context loss', () => {
  const priorContent = 'please review authentication token module expiration flow behavior';
  const notes: NoteRow[] = [
    // Handoff 1: AgentB copies verbatim (loss)
    makeNote('t1', 'AgentA', priorContent, 'AgentB', null, 0),
    makeNote('t1', 'AgentB', priorContent, null, null, 1000),
    // Handoff 2: AgentC responds differently (no loss)
    makeNote('t2', 'AgentA', priorContent, 'AgentC', null, 0),
    makeNote('t2', 'AgentC', 'Starting fresh analysis of the reported issue with a new approach', null, null, 1000),
  ];
  const { totalHandoffs, totalLosses } = buildProfiles(notes);
  expect(totalHandoffs).toBe(2);
  expect(totalLosses).toBe(1);
});

// Test 8: AI recommendations generated (and AI is called)
it('returns AI summary and recommendations when AI call succeeds', async () => {
  const priorContent = 'review authentication token expiration configuration issue';
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', priorContent, 'AgentB', null, 0),
    makeNote('t1', 'AgentB', priorContent, null, null, 1000),
  ];
  mockDb([{ id: 't1', assignedPersona: 'AgentB' }], notes);
  const report = await analyzeContextRetention('proj-1');
  expect(report.aiRecommendations).toBeDefined();
  expect(Array.isArray(report.aiRecommendations)).toBe(true);
  expect(report.aiSummary).not.toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).not.toEqual(FALLBACK_RECOMMENDATIONS);
});
