import { db } from '../db/connection.js';
import { agentSessions, tickets, ticketNotes } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentFeedbackLoopMetrics {
  personaId: string;
  totalFeedbackEvents: number;
  improvementRate: number;
  averageRecoveryTime: number;
  feedbackResponsiveness: 'high' | 'medium' | 'low' | 'none';
  recentTrend: 'improving' | 'stable' | 'degrading';
}

function responsiveness(improvementRate: number, totalFeedbackEvents: number): AgentFeedbackLoopMetrics['feedbackResponsiveness'] {
  if (totalFeedbackEvents === 0) return 'none';
  if (improvementRate >= 70) return 'high';
  if (improvementRate >= 40) return 'medium';
  if (improvementRate > 0) return 'low';
  return 'none';
}

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  ticketId: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

type NoteRow = {
  authorId: string;
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  projectId: string;
  updatedAt: Date;
};

export function computeMetrics(
  personaId: string,
  sessions: SessionRow[],
  notes: NoteRow[],
  projectTickets: TicketRow[],
): AgentFeedbackLoopMetrics {
  // Feedback events: rejected handoffs (note with handoffFrom = personaId where ticket went back to in_progress)
  // proxy: notes where handoffTo = personaId (received a bounced-back handoff) + tickets in in_progress that were in qa/review
  const rejectedHandoffs = notes.filter(n => n.handoffFrom === personaId && n.handoffTo !== null);

  // Tickets bounced: assigned to persona and in_progress (proxy for qa/review rejection)
  const bouncedTickets = projectTickets.filter(t => t.assignedPersona === personaId && t.status === 'in_progress');

  const totalFeedbackEvents = rejectedHandoffs.length + bouncedTickets.length;

  // Sessions sorted by createdAt
  const sorted = [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const totalSessions = sorted.length;

  if (totalSessions < 2 || totalFeedbackEvents < 2) {
    return {
      personaId,
      totalFeedbackEvents,
      improvementRate: 0,
      averageRecoveryTime: 0,
      feedbackResponsiveness: responsiveness(0, totalFeedbackEvents),
      recentTrend: 'stable',
    };
  }

  // Failed sessions = status 'failed'
  const failedIds = new Set(sessions.filter(s => s.status === 'failed').map(s => s.id));

  // Improvement: compare failure rate before vs after feedback events
  const midpoint = Math.floor(totalSessions / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const failRateBefore = firstHalf.filter(s => failedIds.has(s.id)).length / firstHalf.length;
  const failRateAfter = secondHalf.filter(s => failedIds.has(s.id)).length / secondHalf.length;

  let improvementRate = 0;
  if (failRateBefore > 0) {
    improvementRate = Math.max(0, Math.min(100, Math.round(((failRateBefore - failRateAfter) / failRateBefore) * 100)));
  }

  // Recovery time: avg sessions between a failure and next success
  let recoveryDistances: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (failedIds.has(sorted[i].id)) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (!failedIds.has(sorted[j].id)) {
          recoveryDistances.push(j - i);
          break;
        }
      }
    }
  }
  const averageRecoveryTime = recoveryDistances.length > 0
    ? Math.round((recoveryDistances.reduce((s, v) => s + v, 0) / recoveryDistances.length) * 10) / 10
    : 0;

  // Recent trend: last 5 sessions vs overall avg failure rate
  const overallFailRate = sessions.filter(s => failedIds.has(s.id)).length / totalSessions;
  const recent5 = sorted.slice(-5);
  const recentFailRate = recent5.filter(s => failedIds.has(s.id)).length / recent5.length;

  let recentTrend: AgentFeedbackLoopMetrics['recentTrend'];
  const diff = recentFailRate - overallFailRate;
  if (diff < -0.1) recentTrend = 'improving';
  else if (diff > 0.1) recentTrend = 'degrading';
  else recentTrend = 'stable';

  return {
    personaId,
    totalFeedbackEvents,
    improvementRate,
    averageRecoveryTime,
    feedbackResponsiveness: responsiveness(improvementRate, totalFeedbackEvents),
    recentTrend,
  };
}

export async function analyzeAgentFeedbackLoops(projectId: string): Promise<AgentFeedbackLoopMetrics[]> {
  const [allSessions, allNotes, allTickets] = await Promise.all([
    db.select({
      id: agentSessions.id,
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      ticketId: agentSessions.ticketId,
      createdAt: agentSessions.createdAt,
      completedAt: agentSessions.completedAt,
    }).from(agentSessions).where(isNotNull(agentSessions.ticketId)),
    db.select({
      authorId: ticketNotes.authorId,
      ticketId: ticketNotes.ticketId,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
    }).from(ticketNotes).where(isNotNull(ticketNotes.handoffFrom)),
    db.select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      projectId: tickets.projectId,
      updatedAt: tickets.updatedAt,
    }).from(tickets).where(eq(tickets.projectId, projectId)),
  ]);

  // Filter sessions to those whose ticket belongs to this project
  const projectTicketIds = new Set(allTickets.map(t => t.id));
  const projectSessions = allSessions.filter(s => s.ticketId && projectTicketIds.has(s.ticketId));
  const projectNotes = allNotes.filter(n => projectTicketIds.has(n.ticketId));

  // Group sessions by persona
  const personaMap = new Map<string, SessionRow[]>();
  for (const s of projectSessions) {
    if (!personaMap.has(s.personaType)) personaMap.set(s.personaType, []);
    personaMap.get(s.personaType)!.push(s);
  }

  if (personaMap.size === 0) return [];

  const results: AgentFeedbackLoopMetrics[] = [];
  for (const [personaId, sessions] of personaMap) {
    results.push(computeMetrics(personaId, sessions, projectNotes, allTickets));
  }

  results.sort((a, b) => b.improvementRate - a.improvementRate);
  return results;
}
