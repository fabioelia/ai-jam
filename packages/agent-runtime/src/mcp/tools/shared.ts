/**
 * Shared MCP tools available to all personas.
 */

import { z } from 'zod';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSharedTools(
  server: McpServer,
  ctx: { workingDirectory: string },
) {
  /**
   * record_learning -- append to memories.md or project-learnings.md.
   */
  server.tool(
    'record_learning',
    'Record a learning, pattern, or gotcha for future agent sessions. This appends to the shared knowledge files in the project workspace.',
    {
      type: z.enum(['memory', 'learning']).describe('"memory" appends to memories.md, "learning" appends to project-learnings.md'),
      topic: z.string().describe('Short topic label for the entry'),
      content: z.string().describe('The learning content -- what was discovered, what to remember'),
      category: z.enum(['pattern', 'pitfall', 'decision', 'discovery']).default('discovery').describe('Category of the learning'),
    },
    async ({ type, topic, content, category }) => {
      try {
        const filename = type === 'memory' ? 'memories.md' : 'project-learnings.md';
        const filePath = join(ctx.workingDirectory, filename);

        // Ensure the file exists
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const date = new Date().toISOString().split('T')[0];
        const entry = `\n\n## ${date} -- ${topic} [${category}]\n\n${content}\n`;

        appendFileSync(filePath, entry, 'utf-8');

        return {
          content: [{ type: 'text' as const, text: `Learning recorded in ${filename}: "${topic}"` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error recording learning: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
