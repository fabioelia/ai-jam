import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { ticketNotes } from '../db/schema.js';
import { broadcastToTicket } from '../websocket/socket-server.js';

export async function ticketNoteRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List notes for a ticket
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/notes',
    async (request) => {
      return db
        .select()
        .from(ticketNotes)
        .where(eq(ticketNotes.ticketId, request.params.ticketId))
        .orderBy(ticketNotes.createdAt);
    }
  );

  // Create a ticket note (used by agents for handoffs)
  fastify.post<{
    Params: { ticketId: string };
    Body: {
      authorType: 'user' | 'agent';
      authorId: string;
      content: string;
      handoffFrom?: string;
      handoffTo?: string;
      fileUris?: string[];
    };
  }>(
    '/api/tickets/:ticketId/notes',
    async (request) => {
      const { ticketId } = request.params;
      const { authorType, authorId, content, handoffFrom, handoffTo, fileUris } = request.body;

      const [note] = await db
        .insert(ticketNotes)
        .values({
          ticketId,
          authorType: authorType || 'user',
          authorId: authorId || request.user.userId,
          content,
          handoffFrom: handoffFrom || null,
          handoffTo: handoffTo || null,
          fileUris: fileUris || [],
        })
        .returning();

      broadcastToTicket(ticketId, 'agent:handoff', {
        ticketId,
        fromPersona: handoffFrom || '',
        toPersona: handoffTo || '',
        note: content,
      });

      return note;
    }
  );
}
