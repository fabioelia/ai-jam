/**
 * Extract the action source from the X-AI-Jam-Source request header.
 * Returns 'human' by default if the header is not present.
 *
 * Valid values: 'human', 'mcp', 'api'
 */
import type { FastifyRequest } from 'fastify';

const VALID_SOURCES = new Set(['human', 'mcp', 'api']);

export function getSourceFromRequest(request: FastifyRequest): string {
  const header = request.headers['x-ai-jam-source'];
  const value = typeof header === 'string' ? header.toLowerCase() : 'human';
  return VALID_SOURCES.has(value) ? value : 'human';
}
