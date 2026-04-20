import type { FastifyInstance } from 'fastify';
import { eq, and, count, avg, sum, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  agentSessions,
  tickets,
  features,
  projects,
  users,
  comments,
  ticketProposals,
  chatMessages
} from '../db/schema.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get agent performance metrics
  fastify.get<{ Querystring: { startDate?: string; endDate?: string; personaId?: string } }>(
    '/api/analytics/agents/performance',
    async (request) => {
      try {
        const { startDate, endDate, personaId } = request.query;

        const baseConditions = [];
        if (startDate && endDate) {
          baseConditions.push(
            gte(agentSessions.createdAt, new Date(startDate)),
            lte(agentSessions.createdAt, new Date(endDate))
          );
        }
        if (personaId) {
          baseConditions.push(eq(agentSessions.personaType, personaId as string));
        }

        const sessions = await db
          .select({
            personaType: agentSessions.personaType,
            status: agentSessions.status,
            startedAt: agentSessions.startedAt,
            completedAt: agentSessions.completedAt,
            costTokensIn: agentSessions.costTokensIn,
            costTokensOut: agentSessions.costTokensOut,
            retryCount: agentSessions.retryCount,
            activity: agentSessions.activity,
          })
          .from(agentSessions)
          .where(baseConditions.length ? and(...baseConditions) : undefined);

        // Group by persona type and calculate metrics
        const personaMap = new Map();

        sessions.forEach(session => {
          const personaType = session.personaType;
          if (!personaMap.has(personaType)) {
            personaMap.set(personaType, {
              totalSessions: 0,
              completedSessions: 0,
              failedSessions: 0,
              totalDuration: 0,
              totalTokens: 0,
              totalRetries: 0,
              activityCounts: {},
            });
          }

          const metrics = personaMap.get(personaType);
          metrics.totalSessions++;

          if (session.status === 'completed') {
            metrics.completedSessions++;
            if (session.startedAt && session.completedAt) {
              const duration = differenceInMinutes(
                new Date(session.completedAt),
                new Date(session.startedAt)
              );
              metrics.totalDuration += duration;
            }
          } else if (session.status === 'failed') {
            metrics.failedSessions++;
          }

          metrics.totalTokens += (session.costTokensIn || 0) + (session.costTokensOut || 0);
          metrics.totalRetries += session.retryCount || 0;

          const activity = session.activity || 'unknown';
          metrics.activityCounts[activity] = (metrics.activityCounts[activity] || 0) + 1;
        });

        const results = Array.from(personaMap.entries()).map(([personaType, metrics]) => {
          const avgDuration = metrics.completedSessions > 0
            ? metrics.totalDuration / metrics.completedSessions
            : 0;

          const avgTokens = metrics.totalSessions > 0
            ? metrics.totalTokens / metrics.totalSessions
            : 0;

          const successRate = metrics.totalSessions > 0
            ? metrics.completedSessions / metrics.totalSessions
            : 0;

          const activityEntries = Object.entries(metrics.activityCounts);
          const sortedActivities = activityEntries.sort((a, b) => b[1] - a[1]);
          const mostCommonActivity = sortedActivities.length > 0 ? sortedActivities[0][0] : 'unknown';

          return {
            agentId: personaType,
            agentName: personaType,
            totalSessions: metrics.totalSessions,
            completedSessions: metrics.completedSessions,
            failedSessions: metrics.failedSessions,
            successRate,
            avgSessionDuration: avgDuration,
            avgTokensPerSession: avgTokens,
            totalTokensUsed: metrics.totalTokens,
            avgRetryCount: metrics.totalSessions > 0 ? metrics.totalRetries / metrics.totalSessions : 0,
            mostCommonActivity,
            trendingActivity: mostCommonActivity,
            efficiency: calculateEfficiencyScore(
              metrics.completedSessions,
              metrics.totalSessions,
              avgDuration,
              metrics.totalSessions > 0 ? metrics.totalRetries / metrics.totalSessions : 0
            ),
          };
        });

        return results;
      } catch (error) {
        fastify.log.error('Error fetching agent performance metrics:', error);
        throw error;
      }
    }
  );

  // Get project progress analytics
  fastify.get<{ Querystring: { projectId?: string; startDate?: string; endDate?: string } }>(
    '/api/analytics/projects/progress',
    async (request) => {
      try {
        const { projectId, startDate, endDate } = request.query;

        const projectConditions = [];
        if (projectId) {
          projectConditions.push(eq(tickets.projectId, projectId as string));
        }
        if (startDate && endDate) {
          projectConditions.push(
            gte(tickets.createdAt, new Date(startDate)),
            lte(tickets.createdAt, new Date(endDate))
          );
        }

        const projectTickets = await db
          .select({
            projectId: tickets.projectId,
            status: tickets.status,
            storyPoints: tickets.storyPoints,
            createdAt: tickets.createdAt,
            updatedAt: tickets.updatedAt,
          })
          .from(tickets)
          .where(projectConditions.length ? and(...projectConditions) : undefined);

        // Group by project
        const projectMap = new Map();

        projectTickets.forEach(ticket => {
          const pid = ticket.projectId;
          if (!projectMap.has(pid)) {
            projectMap.set(pid, {
              totalTickets: 0,
              completedTickets: 0,
              inProgressTickets: 0,
              backlogTickets: 0,
              totalStoryPoints: 0,
              completedStoryPoints: 0,
              ticketsByStatus: {},
            });
          }

          const metrics = projectMap.get(pid);
          metrics.totalTickets++;
          metrics.ticketsByStatus[ticket.status] = (metrics.ticketsByStatus[ticket.status] || 0) + 1;

          if (ticket.status === 'done') {
            metrics.completedTickets++;
            if (ticket.storyPoints) {
              metrics.completedStoryPoints += ticket.storyPoints;
            }
          } else if (['in_progress', 'review', 'qa', 'acceptance'].includes(ticket.status)) {
            metrics.inProgressTickets++;
          } else {
            metrics.backlogTickets++;
          }

          if (ticket.storyPoints) {
            metrics.totalStoryPoints += ticket.storyPoints;
          }
        });

        // Get project names
        const projectIds = Array.from(projectMap.keys());
        const projectData = await db
          .select({
            id: projects.id,
            name: projects.name,
          })
          .from(projects)
          .where(projectIds.length > 0 ? sql`${projects.id} = ANY(${projectIds})` : undefined);

        const projectNameMap = new Map(projectData.map(p => [p.id, p.name]));

        const results = Array.from(projectMap.entries()).map(([pid, metrics]) => {
          const completionRate = metrics.totalTickets > 0
            ? metrics.completedTickets / metrics.totalTickets
            : 0;

          const averageStoryPoints = metrics.completedTickets > 0
            ? metrics.totalStoryPoints / metrics.totalTickets
            : 0;

          return {
            projectId: pid,
            projectName: projectNameMap.get(pid) || 'Unknown Project',
            totalTickets: metrics.totalTickets,
            completedTickets: metrics.completedTickets,
            inProgressTickets: metrics.inProgressTickets,
            backlogTickets: metrics.backlogTickets,
            completionRate,
            averageStoryPoints,
            totalStoryPoints: metrics.totalStoryPoints,
            completedStoryPoints: metrics.completedStoryPoints,
            velocity: 0,
            cycleTime: 0,
            burndownData: [],
            milestoneProgress: [],
          };
        });

        return results;
      } catch (error) {
        fastify.log.error('Error fetching project progress analytics:', error);
        throw error;
      }
    }
  );
}

function differenceInMinutes(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
}

function calculateEfficiencyScore(
  completedSessions: number,
  totalSessions: number,
  avgDuration: number,
  avgRetries: number
): number {
  const completionScore = (completedSessions / totalSessions) * 40;
  const durationBonus = Math.max(0, (1 - Math.min(avgDuration / 120, 1)) * 30);
  const retryPenalty = Math.max(0, (1 - Math.min(avgRetries / 3, 1)) * 30);

  return Math.min(100, Math.max(0, completionScore + durationBonus + retryPenalty));
}
