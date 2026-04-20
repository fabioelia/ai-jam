import { db } from '../db/connection.js';
import { tickets, ticketNotes, agentSessions } from '../db/schema.js';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentConfidenceCalibration {
  personaId: string;
  totalAssessments: number;
  calibrationScore: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  avgConfidenceLevel: number;
  avgOutcomeSuccessRate: number;
  calibrationGap: number;
  calibrationLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentConfidenceCalibrationReport {
  agents: AgentConfidenceCalibration[];
  avgCalibrationScore: number;
  bestCalibratedAgent: string | null;
  mostOverconfidentAgent: string | null;
  mostUnderconfidentAgent: string | null;
  systemCalibrationGap: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Confidence calibration analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Monitor agent confidence signals against actual outcomes to improve calibration.'];

const HIGH_CONFIDENCE_KEYWORDS = ['confident', 'certain', 'definitely', 'complete', 'done', 'verified', 'confirmed'];
const LOW_CONFIDENCE_KEYWORDS = ['uncertain', 'unsure', 'maybe', 'might', 'possibly', 'unclear', 'blocked', 'needs review'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteRow = {
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  content: string;
  createdAt: Date;
};

export type SessionRow = {
  id: string;
  ticketId: string | null;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

type ConfidenceSignal = 'high' | 'low' | 'neutral';
type OutcomeResult = 'success' | 'failure' | 'unknown';

export function getConfidenceSignal(content: string): ConfidenceSignal {
  const lower = content.toLowerCase();
  for (const kw of HIGH_CONFIDENCE_KEYWORDS) {
    if (lower.includes(kw)) return 'high';
  }
  for (const kw of LOW_CONFIDENCE_KEYWORDS) {
    if (lower.includes(kw)) return 'low';
  }
  return 'neutral';
}

export function getConfidenceScore(signal: ConfidenceSignal): number {
  if (signal === 'high') return 80;
  if (signal === 'low') return 20;
  return 50;
}

export function computeCalibrationLevel(score: number): AgentConfidenceCalibration['calibrationLevel'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function buildCalibrationProfiles(
  ticketRows: TicketRow[],
  notes: NoteRow[],
  sessions: SessionRow[],
): AgentConfidenceCalibration[] {
  // Collect all persona IDs from tickets
  const agentSet = new Set<string>();
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }
  for (const n of notes) {
    if (n.handoffFrom) agentSet.add(n.handoffFrom);
  }

  const profiles: AgentConfidenceCalibration[] = [];

  for (const personaId of agentSet) {
    // Find sessions for this persona
    const personaSessions = sessions.filter((s) => s.personaType === personaId);

    // For each session, determine confidence signal from associated note content
    // and outcome from session status / ticket status
    type Assessment = {
      confidenceScore: number;
      signal: ConfidenceSignal;
      outcome: OutcomeResult;
    };

    const assessments: Assessment[] = [];

    for (const session of personaSessions) {
      // Get confidence signal from notes related to the ticket for this persona
      const ticketId = session.ticketId;
      let signal: ConfidenceSignal = 'neutral';

      if (ticketId) {
        const sessionNotes = notes.filter(
          (n) => n.ticketId === ticketId && (n.handoffFrom === personaId || n.handoffFrom === null),
        );
        for (const note of sessionNotes) {
          const noteSignal = getConfidenceSignal(note.content);
          if (noteSignal !== 'neutral') {
            signal = noteSignal;
            break;
          }
        }
      }

      // Determine outcome
      let outcome: OutcomeResult = 'unknown';

      // Check if session itself is completed (success) or failed
      if (session.status === 'completed') {
        // Check if associated ticket is done
        const ticket = ticketRows.find((t) => t.id === ticketId);
        if (ticket && ticket.status === 'done') {
          outcome = 'success';
        } else {
          outcome = 'success'; // session completed = success proxy
        }
      } else if (session.status === 'failed') {
        outcome = 'failure';
      }

      // Also check handoffs for this session's ticket
      if (ticketId && outcome === 'unknown') {
        const handoffNotes = notes.filter(
          (n) => n.ticketId === ticketId && n.handoffFrom === personaId,
        );
        for (const handoff of handoffNotes) {
          // If there's a handoffTo, it was completed
          if (handoff.handoffTo) {
            outcome = 'success';
          } else {
            outcome = 'failure';
          }
        }
      }

      // Ticket moved to done = success for this persona
      if (ticketId && outcome === 'unknown') {
        const ticket = ticketRows.find((t) => t.id === ticketId);
        if (ticket && ticket.status === 'done') {
          outcome = 'success';
        }
      }

      if (outcome !== 'unknown') {
        assessments.push({
          confidenceScore: getConfidenceScore(signal),
          signal,
          outcome,
        });
      }
    }

    const totalAssessments = assessments.length;

    if (totalAssessments === 0) {
      continue;
    }

    const highConfident = assessments.filter((a) => a.signal === 'high');
    const lowConfident = assessments.filter((a) => a.signal === 'low');

    const highWithFailure = highConfident.filter((a) => a.outcome === 'failure').length;
    const lowWithSuccess = lowConfident.filter((a) => a.outcome === 'success').length;

    const overconfidenceRate =
      highConfident.length > 0 ? (highWithFailure / highConfident.length) * 100 : 0;
    const underconfidenceRate =
      lowConfident.length > 0 ? (lowWithSuccess / lowConfident.length) * 100 : 0;

    const avgConfidenceLevel =
      assessments.reduce((sum, a) => sum + a.confidenceScore, 0) / totalAssessments;

    const successCount = assessments.filter((a) => a.outcome === 'success').length;
    const avgOutcomeSuccessRate = (successCount / totalAssessments) * 100;

    const calibrationGap = Math.abs(avgConfidenceLevel - avgOutcomeSuccessRate);

    // Per-assessment gaps for stddev check
    const perAssessmentGaps = assessments.map((a) => {
      const outcomeScore = a.outcome === 'success' ? 100 : 0;
      return Math.abs(a.confidenceScore - outcomeScore);
    });
    const gapStddev = stddev(perAssessmentGaps);

    const calibrationScore = Math.min(
      100,
      Math.max(
        0,
        (100 - overconfidenceRate) * 0.4 +
          (100 - underconfidenceRate) * 0.3 +
          Math.max(0, Math.min(100, 100 - calibrationGap)) * 0.2 +
          (gapStddev < 15 ? 10 : 0),
      ),
    );

    profiles.push({
      personaId,
      totalAssessments,
      calibrationScore: Math.round(calibrationScore * 100) / 100,
      overconfidenceRate: Math.round(overconfidenceRate * 100) / 100,
      underconfidenceRate: Math.round(underconfidenceRate * 100) / 100,
      avgConfidenceLevel: Math.round(avgConfidenceLevel * 100) / 100,
      avgOutcomeSuccessRate: Math.round(avgOutcomeSuccessRate * 100) / 100,
      calibrationGap: Math.round(calibrationGap * 100) / 100,
      calibrationLevel: computeCalibrationLevel(Math.round(calibrationScore)),
    });
  }

  profiles.sort((a, b) => b.calibrationScore - a.calibrationScore);
  return profiles;
}

export async function analyzeAgentConfidenceCalibration(
  projectId: string,
): Promise<AgentConfidenceCalibrationReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allNotes: NoteRow[] = [];
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        content: ticketNotes.content,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildCalibrationProfiles(projectTickets, allNotes, allSessions);

  const avgCalibrationScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.calibrationScore, 0) / agents.length)
      : 0;

  const bestCalibratedAgent = agents.length > 0 ? agents[0].personaId : null;
  const mostOverconfidentAgent =
    agents.length > 0
      ? agents.reduce((best, a) => (a.overconfidenceRate > best.overconfidenceRate ? a : best), agents[0]).personaId
      : null;
  const mostUnderconfidentAgent =
    agents.length > 0
      ? agents.reduce((best, a) => (a.underconfidenceRate > best.underconfidenceRate ? a : best), agents[0]).personaId
      : null;

  const systemCalibrationGap =
    agents.length > 0
      ? Math.round(
          (agents.reduce((s, a) => s + a.calibrationGap, 0) / agents.length) * 100,
        ) / 100
      : 0;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.personaId}: level=${a.calibrationLevel}, score=${a.calibrationScore.toFixed(1)}, overconfidence=${a.overconfidenceRate.toFixed(1)}%, underconfidence=${a.underconfidenceRate.toFixed(1)}%, gap=${a.calibrationGap.toFixed(1)}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent confidence calibration data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall calibration health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Confidence calibration AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    avgCalibrationScore,
    bestCalibratedAgent,
    mostOverconfidentAgent,
    mostUnderconfidentAgent,
    systemCalibrationGap,
    aiSummary,
    aiRecommendations,
  };
}
