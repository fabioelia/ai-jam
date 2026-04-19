/**
 * Handoff Service - AIJ-FEAT-003: Intelligent Context-Aware Handoffs
 *
 * Handles intelligent handoffs between development phases with context preservation
 * and automated transitions. This service provides:
 *
 * 1. Context capture before handoffs (comments, notes, implementation decisions)
 * 2. Intelligent routing based on ticket type/complexity
 * 3. Automated transition triggering
 * 4. Notification delivery to recipient personas
 * 5. Handoff lifecycle tracking
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, ticketNotes, comments, agentSessions, features, projects } from '../db/schema.js';
import { v4 as uuid } from 'uuid';
import {
  notifyHandoffReceived,
  notifyHandoffCompleted,
  notifyHandoffFailed,
  notifyHandoffOverrideCreated,
  type HandoffNotificationMetadata,
} from './notification-service.js';
import { requestGateAwareMove } from './transition-service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum TicketType {
  FEATURE = 'feature',
  BUG = 'bug',
  REFACTOR = 'refactor',
  DOCUMENTATION = 'documentation',
  INFRASTRUCTURE = 'infrastructure',
  TESTING = 'testing',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
}

export enum ComplexityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface HandoffContext {
  ticketId: string;
  fromPersona: string;
  toPersona?: string;
  summary: string;
  implementationDecisions?: string[];
  blockers?: string[];
  fileContext?: string[];
}

export interface RoutingDecision {
  targetPersona: string;
  targetStatus: string;
  reason: string;
  requiresApproval: boolean;
  ticketType?: TicketType;
  complexity?: ComplexityLevel;
  manualOverride?: boolean;
  overrideReason?: string;
}

export interface BoardState {
  projectId: string;
  columns: Array<{
    status: string;
    count: number;
  }>;
  totalTickets: number;
  bottlenecks?: string[];
}

export interface ComplexityScore {
  level: ComplexityLevel;
  score: number;
  factors: string[];
}

export interface HandoffResult {
  success: boolean;
  handoffId?: string;
  noteId?: string;
  transitionRequested?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Handoff Service
// ---------------------------------------------------------------------------

export class HandoffService {
  /**
   * Classify ticket type based on title and description content.
   * Uses keyword matching and pattern analysis.
   */
  public classifyTicketType(title: string, description?: string): TicketType {
    const text = `${title} ${description || ''}`.toLowerCase();

    // Bug indicators
    if (text.match(/\b(bug|fix|error|crash|fail|broken|issue|defect|exception|glitch)\b/)) {
      return TicketType.BUG;
    }

    // Refactoring indicators
    if (text.match(/\b(refactor|cleanup|simplify|optimize|debt|technical|improve.*code|restructure)\b/)) {
      return TicketType.REFACTOR;
    }

    // Documentation indicators
    if (text.match(/\b(doc|document|readme|wiki|guide|tutorial|comment|docstring)\b/)) {
      return TicketType.DOCUMENTATION;
    }

    // Infrastructure indicators
    if (text.match(/\b(infra|deploy|ci|cd|pipeline|docker|k8s|aws|gcp|azure|devops|setup|config)\b/)) {
      return TicketType.INFRASTRUCTURE;
    }

    // Testing indicators
    if (text.match(/\b(test|spec|coverage|e2e|unit.*test|integration.*test|mock|fixture)\b/)) {
      return TicketType.TESTING;
    }

    // Security indicators
    if (text.match(/\b(security|auth|permission|vulnerability|xss|csrf|injection|encrypt|ssl)\b/)) {
      return TicketType.SECURITY;
    }

    // Performance indicators
    if (text.match(/\b(perf|performance|slow|latency|optimi(z|s)e|cache|load|scale|benchmark)\b/)) {
      return TicketType.PERFORMANCE;
    }

    // Default to feature
    return TicketType.FEATURE;
  }

  /**
   * Analyze ticket complexity based on multiple factors.
   * Returns a complexity level and detailed scoring.
   */
  public analyzeComplexity(ticket: any): ComplexityScore {
    let score = 0;
    const factors: string[] = [];

    // Story points (if available)
    if (ticket.storyPoints) {
      score += ticket.storyPoints * 2;
      factors.push(`Story points: ${ticket.storyPoints}`);
    }

    // Description length (longer descriptions often indicate more complex work)
    if (ticket.description) {
      const wordCount = ticket.description.split(/\s+/).length;
      if (wordCount > 300) {
        score += 15;
        factors.push('Long description (>300 words)');
      } else if (wordCount > 150) {
        score += 8;
        factors.push('Medium-length description (150-300 words)');
      }
    }

    // Dependencies (more dependencies = more complex)
    if (ticket.dependencies && ticket.dependencies.length > 0) {
      score += ticket.dependencies.length * 5;
      factors.push(`${ticket.dependencies.length} dependencies`);
    }

    // Priority
    if (ticket.priority === 'critical') {
      score += 20;
      factors.push('Critical priority');
    } else if (ticket.priority === 'high') {
      score += 10;
      factors.push('High priority');
    }

    // Complexity keywords in description
    if (ticket.description) {
      const complexityKeywords = [
        'complex', 'complicated', 'challenge', 'difficult', 'intricate',
        'architecture', 'redesign', 'rewrite', 'migration', 'integration',
      ];
      const foundKeywords = complexityKeywords.filter((kw) =>
        ticket.description.toLowerCase().includes(kw)
      );
      if (foundKeywords.length > 0) {
        score += foundKeywords.length * 5;
        factors.push(`Complexity keywords: ${foundKeywords.join(', ')}`);
      }
    }

    // Determine complexity level based on score
    let level: ComplexityLevel;
    if (score >= 50) {
      level = ComplexityLevel.CRITICAL;
    } else if (score >= 30) {
      level = ComplexityLevel.HIGH;
    } else if (score >= 15) {
      level = ComplexityLevel.MEDIUM;
    } else {
      level = ComplexityLevel.LOW;
    }

    return { level, score, factors };
  }

  /**
   * Fetch board state for a project to understand workflow context.
   * Identifies bottlenecks and workflow patterns.
   */
  public async getBoardState(projectId: string): Promise<BoardState> {
    try {
      // Get ticket counts by status
      const statusCounts = await db
        .select({
          status: tickets.status,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(tickets)
        .where(eq(tickets.projectId, projectId))
        .groupBy(tickets.status);

      const totalTickets = statusCounts.reduce((sum, row) => sum + Number(row.count), 0);

      // Identify bottlenecks (columns with significantly more tickets than average)
      const avgTicketsPerColumn = statusCounts.length > 0 ? totalTickets / statusCounts.length : 0;
      const bottlenecks: string[] = [];
      statusCounts.forEach((row) => {
        if (Number(row.count) > avgTicketsPerColumn * 2) {
          bottlenecks.push(row.status);
        }
      });

      return {
        projectId,
        columns: statusCounts,
        totalTickets,
        bottlenecks: bottlenecks.length > 0 ? bottlenecks : undefined,
      };
    } catch (error) {
      console.error('Failed to fetch board state:', error);
      return {
        projectId,
        columns: [],
        totalTickets: 0,
      };
    }
  }

  /**
   * Check for existing manual override for this ticket.
   */
  public async getManualOverride(ticketId: string): Promise<{ targetPersona?: string; targetStatus?: string; reason?: string } | null> {
    try {
      // Look for override notes in the ticket notes
      const overrideNotes = await db
        .select()
        .from(ticketNotes)
        .where(
          and(
            eq(ticketNotes.ticketId, ticketId),
            // Notes that contain override information
          ),
        )
        .orderBy(desc(ticketNotes.createdAt))
        .limit(5);

      // Parse notes for override information
      for (const note of overrideNotes) {
        if (note.content.includes('OVERRIDE:') || note.content.includes('Manual override')) {
          // Simple parsing - in production, would use more robust parsing
          const targetPersonaMatch = note.content.match(/target.*persona[:\s]+([a-z_]+)/i);
          const targetStatusMatch = note.content.match(/target.*status[:\s]+([a-z_]+)/i);
          const reasonMatch = note.content.match(/override.*reason[:\s]+(.+)$/im);

          return {
            targetPersona: targetPersonaMatch?.[1],
            targetStatus: targetStatusMatch?.[1],
            reason: reasonMatch?.[1]?.trim(),
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get manual override:', error);
      return null;
    }
  }

  /**
   * Capture comprehensive context for a ticket before handoff.
   * Includes comments, notes, agent session history, and implementation details.
   */
  async captureContext(ticketId: string): Promise<HandoffContext> {
    const [ticket, ticketComments, ticketNotesData, recentSessions] = await Promise.all([
      db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1),
      db.select().from(comments).where(eq(comments.ticketId, ticketId)).orderBy(desc(comments.createdAt)),
      db.select().from(ticketNotes).where(eq(ticketNotes.ticketId, ticketId)).orderBy(desc(ticketNotes.createdAt)),
      db.select().from(agentSessions).where(eq(agentSessions.ticketId, ticketId)).orderBy(desc(agentSessions.createdAt)).limit(3),
    ]);

    if (!ticket[0]) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const ticketData = ticket[0];

    // Extract implementation decisions from notes and sessions
    const implementationDecisions: string[] = [];
    const blockers: string[] = [];
    const fileContext: string[] = [];

    // Parse notes for implementation decisions and blockers
    for (const note of ticketNotesData) {
      if (note.content.includes('## Work Complete') || note.content.includes('Implementation')) {
        implementationDecisions.push(note.content.substring(0, 500)); // Truncate for summary
      }
      if (note.content.includes('Blocker') || note.content.includes('blocked')) {
        blockers.push(note.content.substring(0, 300));
      }
      const uris = Array.isArray(note.fileUris) ? note.fileUris : [];
      if (uris.length > 0) {
        fileContext.push(...uris);
      }
    }

    // Extract decisions from agent sessions
    for (const session of recentSessions) {
      if (session.outputSummary) {
        implementationDecisions.push(session.outputSummary);
      }
    }

    return {
      ticketId,
      fromPersona: ticketData.assignedPersona || 'unknown',
      summary: `Handoff from ${ticketData.assignedPersona || 'unknown'} for ticket "${ticketData.title}"`,
      implementationDecisions: implementationDecisions.slice(0, 5), // Limit to 5 most recent
      blockers: blockers.length > 0 ? blockers : undefined,
      fileContext: fileContext.length > 0 ? [...new Set(fileContext)] : undefined,
    };
  }

  /**
   * Determine the next persona and status based on current state and routing rules.
   * Implements intelligent routing based on ticket type, complexity, and current status.
   * Supports manual override of automatic routing decisions.
   */
  async determineNextRoute(
    ticket: any,
    boardState?: BoardState,
    manualOverride?: { targetPersona?: string; targetStatus?: string; reason?: string },
  ): Promise<RoutingDecision> {
    // Check for manual override first
    if (manualOverride) {
      return {
        targetPersona: manualOverride.targetPersona || ticket.assignedPersona || 'unknown',
        targetStatus: manualOverride.targetStatus || ticket.status,
        reason: manualOverride.reason || 'Manual override applied',
        requiresApproval: true,
        manualOverride: true,
        overrideReason: manualOverride.reason,
      };
    }

    // Classify ticket type
    const ticketType = this.classifyTicketType(ticket.title, ticket.description);

    // Analyze complexity
    const complexity = this.analyzeComplexity(ticket);

    // Standard workflow routing with type-based adjustments
    const workflowRoutes: Record<string, Partial<RoutingDecision>> = {
      'backlog': {
        targetPersona: 'implementer',
        targetStatus: 'in_progress',
        reason: 'Ready for implementation',
        requiresApproval: false,
      },
      'in_progress': {
        targetPersona: 'reviewer',
        targetStatus: 'review',
        reason: 'Implementation complete, ready for review',
        requiresApproval: false,
      },
      'review': {
        targetPersona: 'qa_tester',
        targetStatus: 'qa',
        reason: 'Review approved, ready for QA testing',
        requiresApproval: false,
      },
      'qa': {
        targetPersona: 'acceptance_validator',
        targetStatus: 'acceptance',
        reason: 'QA passed, ready for acceptance validation',
        requiresApproval: false,
      },
      'acceptance': {
        targetPersona: undefined,
        targetStatus: 'done',
        reason: 'All criteria met, ticket complete',
        requiresApproval: true,
      },
    };

    // Get base route for current status
    const baseRoute = workflowRoutes[ticket.status];

    if (!baseRoute) {
      return {
        targetPersona: ticket.assignedPersona || 'unknown',
        targetStatus: ticket.status,
        reason: 'No automated route available, manual intervention required',
        requiresApproval: true,
        ticketType,
        complexity: complexity.level,
      };
    }

    // Apply type-based routing adjustments
    let targetPersona = baseRoute.targetPersona;
    let targetStatus = baseRoute.targetStatus;
    let reason = baseRoute.reason;
    let requiresApproval = baseRoute.requiresApproval || false;

    // Security tickets always require approval and may need security review
    if (ticketType === TicketType.SECURITY) {
      requiresApproval = true;
      reason += ' (Security review required)';
    }

    // Critical complexity tickets require additional review
    if (complexity.level === ComplexityLevel.CRITICAL) {
      requiresApproval = true;
      reason += ' (Critical complexity requires approval)';
    }

    // Bug fixes may skip some gates for critical priority
    if (ticketType === TicketType.BUG && ticket.priority === 'critical' && ticket.status === 'in_progress') {
      targetPersona = 'qa_tester';
      targetStatus = 'qa';
      reason = 'Critical bug: expedite to QA';
      requiresApproval = false;
    }

    // Infrastructure tickets may need different routing
    if (ticketType === TicketType.INFRASTRUCTURE && ticket.status === 'review') {
      reason += ' (Infrastructure change - additional validation recommended)';
      requiresApproval = true;
    }

    // Consider board state for workflow awareness
    if (boardState && boardState.bottlenecks) {
      // If review is a bottleneck, suggest expedited routing
      if (boardState.bottlenecks.includes('review') && ticket.status === 'in_progress') {
        reason += ' (Review bottleneck detected - may require prioritization)';
      }
      // If QA is a bottleneck, suggest alternative path
      if (boardState.bottlenecks.includes('qa') && ticket.status === 'review') {
        reason += ' (QA bottleneck detected - consider reviewer-to-QA ratio)';
      }
    }

    return {
      targetPersona: targetPersona || ticket.assignedPersona || 'unknown',
      targetStatus: targetStatus || ticket.status,
      reason: reason || 'Routing decision made',
      requiresApproval,
      ticketType,
      complexity: complexity.level,
    };
  }

  /**
   * Execute a handoff with context preservation.
   * Creates a handoff note, triggers notification, and requests transition if applicable.
   * Uses intelligent routing with complexity analysis and board state awareness.
   */
  async executeHandoff(
    context: HandoffContext,
    requestTransition = true,
    manualOverride?: { targetPersona?: string; targetStatus?: string; reason?: string },
  ): Promise<HandoffResult> {
    try {
      // Get ticket details for routing
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, context.ticketId)).limit(1);
      if (!ticket) {
        return { success: false, error: `Ticket ${context.ticketId} not found` };
      }

      // Fetch board state for workflow awareness
      const boardState = await this.getBoardState(ticket.projectId);

      // Check for existing manual override if not provided
      const existingOverride = manualOverride || (await this.getManualOverride(context.ticketId)) || undefined;

      // Determine next route with intelligent routing
      const route = await this.determineNextRoute(ticket, boardState, existingOverride);

      let targetStatus = ticket.status as string;
      if (requestTransition && route.targetStatus !== targetStatus) {
        targetStatus = route.targetStatus;
      }

      // Build handoff content with full context including routing info
      const handoffContent = this.buildHandoffContent(context, ticket, route);

      // Create handoff note
      const [note] = await db
        .insert(ticketNotes)
        .values({
          ticketId: context.ticketId,
          authorType: 'agent',
          authorId: 'handoff-service',
          content: handoffContent,
          handoffFrom: context.fromPersona,
          handoffTo: route.targetPersona || null,
          fileUris: context.fileContext || [],
          source: 'mcp',
        })
        .returning();

      // Send notification to relevant users
      await this.sendHandoffNotification(context, ticket, targetStatus, route);

      // Request transition if specified
      let transitionRequested = false;
      if (requestTransition && targetStatus !== ticket.status) {
        try {
          await requestGateAwareMove({
            ticketId: context.ticketId,
            toStatus: targetStatus as any,
            requestedBy: context.fromPersona,
          });
          transitionRequested = true;
        } catch (err) {
          console.error('[handoff-service] Transition request failed:', err instanceof Error ? err.message : err);
        }
      }

      return {
        success: true,
        handoffId: note.id,
        noteId: note.id,
        transitionRequested,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during handoff',
      };
    }
  }

  /**
   * Create a manual override note for a ticket.
   * This allows users to override automatic routing decisions.
   * Sends notification to relevant users when override is created.
   */
  async createManualOverride(
    ticketId: string,
    override: { targetPersona?: string; targetStatus?: string; reason: string },
  ): Promise<{ success: boolean; noteId?: string; error?: string }> {
    try {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
      if (!ticket) {
        return { success: false, error: `Ticket ${ticketId} not found` };
      }

      const overrideContent = `## Manual Routing Override\n\n`;
      const content = `${overrideContent}**Override Reason:** ${override.reason}\n`;
      const targetPersona = `${override.targetPersona ? `\n**Target Persona:** ${override.targetPersona}` : ''}`;
      const targetStatus = `${override.targetStatus ? `\n**Target Status:** ${override.targetStatus}` : ''}`;
      const metadata = `\n**Timestamp:** ${new Date().toISOString()}\n**Current Status:** ${ticket.status}\n**Current Persona:** ${ticket.assignedPersona || 'unassigned'}\n\n---\n*Manual override created by user*`;

      const [note] = await db
        .insert(ticketNotes)
        .values({
          ticketId,
          authorType: 'user',
          authorId: 'manual-override',
          content: content + targetPersona + targetStatus + metadata,
          source: 'mcp',
        })
        .returning();

      await notifyHandoffOverrideCreated(ticketId, override, {
        ticketTitle: ticket.title,
        ticketPriority: ticket.priority,
      });

      return { success: true, noteId: note.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating override',
      };
    }
  }

  /**
   * Build comprehensive handoff content including all context.
   * Now includes routing information, ticket type, and complexity level.
   */
  private buildHandoffContent(context: HandoffContext, ticket: any, route: RoutingDecision): string {
    let content = `## Handoff: ${context.fromPersona} → ${context.toPersona || route.targetPersona || 'Next'}\n\n`;
    content += `**Ticket:** ${ticket.title}\n`;
    content += `**Status:** ${ticket.status} → ${route.targetStatus || 'pending'}\n`;
    content += `**Priority:** ${ticket.priority}\n`;
    if (route.ticketType) {
      content += `**Type:** ${route.ticketType}\n`;
    }
    if (route.complexity) {
      content += `**Complexity:** ${route.complexity}\n`;
    }
    if (route.manualOverride) {
      content += `**⚠️ Manual Override:** ${route.overrideReason || 'Applied'}\n`;
    }
    content += `**Routing Reason:** ${route.reason}\n`;
    content += `**Timestamp:** ${new Date().toISOString()}\n\n`;

    if (context.summary) {
      content += `### Summary\n${context.summary}\n\n`;
    }

    if (context.implementationDecisions && context.implementationDecisions.length > 0) {
      content += `### Implementation Decisions\n`;
      context.implementationDecisions.forEach((decision, i) => {
        content += `${i + 1}. ${decision}\n`;
      });
      content += '\n';
    }

    if (context.blockers && context.blockers.length > 0) {
      content += `### Blockers\n`;
      context.blockers.forEach((blocker) => {
        content += `- ${blocker}\n`;
      });
      content += '\n';
    }

    if (context.fileContext && context.fileContext.length > 0) {
      content += `### File Context\n`;
      context.fileContext.forEach((file) => {
        content += `- \`${file}\`\n`;
      });
      content += '\n';
    }

    content += `---\n*Handoff generated by AI Jam Handoff Service*`;

    return content;
  }

  /**
   * Send notifications about handoff to relevant users.
   * Uses specialized handoff notification functions with routing metadata.
   */
  private async sendHandoffNotification(
    context: HandoffContext,
    ticket: any,
    targetStatus: string,
    route: RoutingDecision,
  ): Promise<void> {
    try {
      const toPersona = route.targetPersona || context.toPersona || 'unknown';

      const metadata: HandoffNotificationMetadata = {
        fromPersona: context.fromPersona,
        toPersona: toPersona,
        ticketTitle: ticket.title,
        ticketPriority: ticket.priority,
        ticketType: route.ticketType,
        complexity: route.complexity,
        manualOverride: route.manualOverride,
        routingReason: route.reason,
        transitionFrom: ticket.status,
        transitionTo: targetStatus,
      };

      await notifyHandoffReceived(ticket.id, context.fromPersona, toPersona, metadata);
    } catch (error) {
      console.error('Failed to send handoff notification:', error);
      await notifyHandoffFailed(ticket.id, context.fromPersona, error instanceof Error ? error.message : 'Unknown error', {
        ticketTitle: ticket.title,
        ticketPriority: ticket.priority,
      });
    }
  }

  /**
   * Get handoff history for a ticket.
   */
  async getHandoffHistory(ticketId: string): Promise<any[]> {
    const handoffNotes = await db
      .select()
      .from(ticketNotes)
      .where(
        and(
          eq(ticketNotes.ticketId, ticketId),
          // Only get notes that are handoffs (have handoffFrom or handoffTo)
        ),
      )
      .orderBy(desc(ticketNotes.createdAt));

    // Filter to only actual handoffs
    return handoffNotes.filter((note) => note.handoffFrom || note.handoffTo);
  }

  /**
   * Get pending handoffs that need attention.
   */
  async getPendingHandoffs(projectId?: string): Promise<any[]> {
    // This would be enhanced with actual "pending" status tracking
    // For now, return recent handoffs
    let query = db
      .select()
      .from(ticketNotes)
      .where(
        and(
          // handoffFrom is not null (it's a handoff)
        ),
      )
      .orderBy(desc(ticketNotes.createdAt))
      .limit(20);

    // Return handoffs that have both a source and destination (pending handoff notes)
    return allNotes.filter(
      (note) => note.handoffFrom !== null && note.handoffTo !== null
    );
  }
}

// Export singleton instance
export const handoffService = new HandoffService();
