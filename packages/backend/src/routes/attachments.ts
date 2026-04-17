import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

export interface AttachmentData {
  id: string;
  type: 'image' | 'document';
  mimeType: string;
  url: string;
  filename: string;
  size: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];

export async function attachmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/api/attachments/upload', async (request, reply) => {
    try {
      const data = await request.file({
        limits: { fileSize: MAX_FILE_SIZE },
      });

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const mimeType = data.mimetype;
      const filename = data.filename || 'unnamed';
      const buffer = await data.toBuffer();

      // Validate file type
      const type: 'image' | 'document' = ALLOWED_IMAGE_TYPES.includes(mimeType) ? 'image' :
        ALLOWED_DOC_TYPES.includes(mimeType) ? 'document' :
        null as unknown as 'image' | 'document';

      if (!type) {
        return reply.status(400).send({ error: `Unsupported file type: ${mimeType}` });
      }

      // Generate unique ID and create URL
      const id = randomUUID();
      const extension = filename.split('.').pop() || '';
      const url = `/api/attachments/${id}.${extension}`;

      // In production, upload to S3 or other storage
      // For now, store metadata and return URL for frontend
      const attachment: AttachmentData = {
        id,
        type,
        mimeType,
        url,
        filename,
        size: buffer.length,
      };

      // Store attachment metadata in memory or database as needed
      // For now, return the attachment data directly
      return reply.send({ attachment });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Upload failed: ${message}` });
    }
  });

  fastify.get<{ Params: { id: string } }>('/api/attachments/:id', async (request, reply) => {
    // Serve file by ID
    // In production, fetch from S3 or storage
    return reply.status(404).send({ error: 'Attachment not found' });
  });

  fastify.delete<{ Params: { id: string } }>('/api/attachments/:id', async (request, reply) => {
    // Delete file by ID
    // In production, delete from S3 or storage
    return reply.status(404).send({ error: 'Attachment not found' });
  });
}
