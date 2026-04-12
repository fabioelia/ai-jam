/**
 * MCP tools for the execution phase (implementer, reviewer, qa_tester, acceptance_validator).
 * These tools let agents signal completion, request transitions, report blockers,
 * and interact with tickets -- all through the backend REST API.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';

export function registerExecutionTools(
  server: McpServer,
  api: ApiClient,
  ctx: { projectId: string; featureId: string; sessionId: string; ticketId?: string },
) {
  /**
   * signal_complete -- signal that the agent has finished its work on the current ticket.
   */
  server.tool(
    'signal_complete',
    'Signal that you have completed your work on the current ticket. Provide a summary of what was done and optionally suggest the next persona and transition.',
    {
      summary: z.string().describe('Summary of what was accomplished'),
      nextPersona: z.string().optional().describe('Suggested next persona (e.g. "reviewer", "qa_tester", "implementer")'),
      requestTransition: z.string().optional().describe('Requested ticket status transition (e.g. "review", "qa", "in_progress", "done")'),
      transitionReason: z.string().optional().describe('Reason for the transition request'),
    },
    async ({ summary, nextPersona, requestTransition, transitionReason }) => {
      const results: string[] = [];

      try {
        // Add a completion note to the ticket
        if (ctx.ticketId) {
          await api.post(`/api/tickets/${ctx.ticketId}/notes`, {
            authorType: 'agent',
            authorId: ctx.sessionId,
            content: `## Work Complete\n\n${summary}`,
            handoffFrom: undefined,
            handoffTo: nextPersona || undefined,
          });
          results.push('Completion note added to ticket.');
        }

        // Request transition if specified
        if (requestTransition && ctx.ticketId) {
          try {
            await api.post(`/api/tickets/${ctx.ticketId}/move`, {
              toStatus: requestTransition,
            });
            results.push(`Ticket moved to ${requestTransition}.`);
          } catch (err) {
            // Transition might require a gate -- create a transition gate request
            try {
              await api.post('/api/transition-gates', {
                ticketId: ctx.ticketId,
                fromStatus: 'current', // backend will resolve
                toStatus: requestTransition,
                gatekeeperPersona: nextPersona || 'reviewer',
                agentSessionId: ctx.sessionId,
              });
              results.push(`Transition gate requested for move to ${requestTransition}.`);
            } catch (gateErr) {
              results.push(`Transition request failed: ${(gateErr as Error).message}`);
            }
          }
        }

        return {
          content: [{ type: 'text' as const, text: results.join('\n') }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error signaling completion: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * request_transition -- request a ticket column move.
   */
  server.tool(
    'request_transition',
    'Request to move a ticket to a different column on the board. Some transitions require gatekeeper approval.',
    {
      ticketId: z.string().uuid().optional().describe('Ticket ID to transition (defaults to current ticket)'),
      toStatus: z.enum(['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done']).describe('Target column/status'),
      reason: z.string().describe('Why this transition is appropriate'),
    },
    async ({ ticketId, toStatus, reason }) => {
      const targetTicket = ticketId || ctx.ticketId;
      if (!targetTicket) {
        return {
          content: [{ type: 'text' as const, text: 'Error: No ticket ID provided and no current ticket context.' }],
          isError: true,
        };
      }

      try {
        const result = await api.post(`/api/tickets/${targetTicket}/move`, {
          toStatus,
        });
        return {
          content: [{ type: 'text' as const, text: `Ticket moved to ${toStatus}. Reason: ${reason}\n\n${JSON.stringify(result, null, 2)}` }],
        };
      } catch (err) {
        // If direct move fails, try creating a transition gate
        try {
          const gate = await api.post('/api/transition-gates', {
            ticketId: targetTicket,
            fromStatus: 'current',
            toStatus,
            gatekeeperPersona: 'reviewer',
            agentSessionId: ctx.sessionId,
          });
          return {
            content: [{ type: 'text' as const, text: `Transition gate created (requires approval). Reason: ${reason}\n\n${JSON.stringify(gate, null, 2)}` }],
          };
        } catch (gateErr) {
          return {
            content: [{ type: 'text' as const, text: `Error requesting transition: ${(gateErr as Error).message}` }],
            isError: true,
          };
        }
      }
    },
  );

  /**
   * report_blocker -- flag a blocker on the current ticket.
   */
  server.tool(
    'report_blocker',
    'Report a blocker that prevents you from completing the current ticket. This creates a note on the ticket and alerts the team.',
    {
      description: z.string().describe('Description of what is blocking progress'),
      blockedByTicketId: z.string().uuid().optional().describe('ID of the ticket that is causing the block, if applicable'),
      severity: z.enum(['critical', 'high', 'medium']).default('high').describe('How severe the blocker is'),
    },
    async ({ description, blockedByTicketId, severity }) => {
      if (!ctx.ticketId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: No current ticket context for reporting blocker.' }],
          isError: true,
        };
      }

      try {
        let content = `## Blocker Reported (${severity})\n\n${description}`;
        if (blockedByTicketId) {
          content += `\n\n**Blocked by ticket:** ${blockedByTicketId}`;
        }

        const note = await api.post(`/api/tickets/${ctx.ticketId}/notes`, {
          authorType: 'agent',
          authorId: ctx.sessionId,
          content,
        });

        return {
          content: [{ type: 'text' as const, text: `Blocker reported on ticket.\n\n${JSON.stringify(note, null, 2)}` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error reporting blocker: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * add_ticket_comment -- add a comment to a ticket.
   */
  server.tool(
    'add_ticket_comment',
    'Add a comment to a ticket. Use this for review feedback, test results, or any other ticket-level communication.',
    {
      ticketId: z.string().uuid().optional().describe('Ticket ID to comment on (defaults to current ticket)'),
      body: z.string().min(1).describe('Comment body (markdown supported)'),
    },
    async ({ ticketId, body }) => {
      const targetTicket = ticketId || ctx.ticketId;
      if (!targetTicket) {
        return {
          content: [{ type: 'text' as const, text: 'Error: No ticket ID provided and no current ticket context.' }],
          isError: true,
        };
      }

      try {
        const comment = await api.post(`/api/tickets/${targetTicket}/comments`, {
          body,
        });
        return {
          content: [{ type: 'text' as const, text: `Comment added.\n\n${JSON.stringify(comment, null, 2)}` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error adding comment: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * get_ticket_details -- read a ticket with its comments and notes.
   */
  server.tool(
    'get_ticket_details',
    'Get full details of a ticket including description, comments, and handoff notes. Use this to understand the ticket requirements and history.',
    {
      ticketId: z.string().uuid().optional().describe('Ticket ID to read (defaults to current ticket)'),
    },
    async ({ ticketId }) => {
      const targetTicket = ticketId || ctx.ticketId;
      if (!targetTicket) {
        return {
          content: [{ type: 'text' as const, text: 'Error: No ticket ID provided and no current ticket context.' }],
          isError: true,
        };
      }

      try {
        const [ticket, comments, notes, gates] = await Promise.all([
          api.get(`/api/tickets/${targetTicket}`),
          api.get(`/api/tickets/${targetTicket}/comments`),
          api.get(`/api/tickets/${targetTicket}/notes`),
          api.get(`/api/tickets/${targetTicket}/gates`),
        ]);

        const details = { ticket, comments, notes, transitionGates: gates };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(details, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching ticket details: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * get_board_state -- read the current kanban board for this project.
   * Available to execution agents so they can see ticket status and priorities.
   */
  server.tool(
    'get_board_state',
    'Get the current board state showing all tickets organized by column (backlog, in_progress, review, qa, acceptance, done). Useful for understanding context and priorities.',
    {
      featureOnly: z.boolean().default(false).describe('If true, only show tickets for the current feature'),
    },
    async ({ featureOnly }) => {
      try {
        let path = `/api/projects/${ctx.projectId}/board`;
        if (featureOnly && ctx.featureId) {
          path += `?featureId=${ctx.featureId}`;
        }
        const board = await api.get(path);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(board, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching board: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
