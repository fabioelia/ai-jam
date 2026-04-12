/**
 * MCP tools for the planning phase (planner persona).
 * These tools let the agent propose epics and tickets, read board state,
 * and get feature context -- all through the backend REST API.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';

export function registerPlanningTools(
  server: McpServer,
  api: ApiClient,
  ctx: { projectId: string; featureId: string; sessionId: string },
) {
  /**
   * propose_epic -- create an epic for the current feature.
   */
  server.tool(
    'propose_epic',
    'Create an epic to group related tickets under the current feature. Returns the created epic.',
    {
      title: z.string().min(1).max(500).describe('Epic title'),
      description: z.string().optional().describe('Epic description'),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('Hex color for the epic (e.g. #6366f1)'),
    },
    async ({ title, description, color }) => {
      try {
        const epic = await api.post(`/api/features/${ctx.featureId}/epics`, {
          title,
          description,
          color,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(epic, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error creating epic: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * propose_tickets -- create ticket proposals (pending human approval).
   */
  server.tool(
    'propose_tickets',
    'Propose one or more tickets for the current feature. These go into a pending state awaiting human approval. Each ticket should have a clear title, description, and acceptance criteria.',
    {
      tickets: z.array(z.object({
        title: z.string().min(1).max(500).describe('Ticket title'),
        description: z.string().describe('Detailed ticket description including implementation guidance'),
        epicTitle: z.string().optional().describe('Title of the epic this ticket belongs to (must match an existing epic)'),
        priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium').describe('Ticket priority'),
        storyPoints: z.number().int().positive().optional().describe('Estimated story points (1-8)'),
        acceptanceCriteria: z.array(z.string()).optional().describe('List of acceptance criteria for this ticket'),
      })).min(1).describe('Array of ticket proposals'),
    },
    async ({ tickets }) => {
      const results: unknown[] = [];
      const errors: string[] = [];

      for (const ticket of tickets) {
        try {
          // Build full description with acceptance criteria
          let fullDescription = ticket.description;
          if (ticket.acceptanceCriteria?.length) {
            fullDescription += '\n\n## Acceptance Criteria\n';
            for (const criterion of ticket.acceptanceCriteria) {
              fullDescription += `- [ ] ${criterion}\n`;
            }
          }

          // Create proposal via the planning-service endpoint
          // The chat-sessions route handles proposals through the planning service,
          // but we can create them directly via the proposals mechanism.
          // We post to the feature's proposals endpoint.
          const proposal = await api.post(`/api/features/${ctx.featureId}/proposals`, {
            chatSessionId: ctx.sessionId,
            ticketData: {
              title: ticket.title,
              description: fullDescription,
              epicTitle: ticket.epicTitle,
              priority: ticket.priority,
              storyPoints: ticket.storyPoints,
              acceptanceCriteria: ticket.acceptanceCriteria,
            },
          });
          results.push(proposal);
        } catch (err) {
          errors.push(`Failed to propose "${ticket.title}": ${(err as Error).message}`);
        }
      }

      const summary = {
        proposed: results.length,
        failed: errors.length,
        proposals: results,
        errors: errors.length > 0 ? errors : undefined,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        isError: errors.length > 0 && results.length === 0,
      };
    },
  );

  /**
   * get_board_state -- read the current kanban board for this project.
   */
  server.tool(
    'get_board_state',
    'Get the current board state showing all tickets organized by column (backlog, in_progress, review, qa, acceptance, done). Optionally filter to just the current feature.',
    {
      featureOnly: z.boolean().default(true).describe('If true, only show tickets for the current feature'),
    },
    async ({ featureOnly }) => {
      try {
        let path = `/api/projects/${ctx.projectId}/board`;
        if (featureOnly) {
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

  /**
   * get_feature_context -- read feature details and existing tickets/proposals.
   */
  server.tool(
    'get_feature_context',
    'Get the current feature details including title, description, existing tickets, and pending proposals. Use this to understand what has already been planned.',
    {},
    async () => {
      try {
        const [feature, tickets, proposals, epics] = await Promise.all([
          api.get(`/api/features/${ctx.featureId}`),
          api.get(`/api/projects/${ctx.projectId}/tickets?featureId=${ctx.featureId}`),
          api.get(`/api/features/${ctx.featureId}/proposals`),
          api.get(`/api/features/${ctx.featureId}/epics`),
        ]);

        const context = { feature, tickets, proposals, epics };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(context, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching feature context: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
