import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { db, pool } from './connection.js';
import { personaDefinitions } from './schema.js';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PERSONAS_DIR = join(__dirname, '../../../agent-runtime/personas');

async function seedPersonas() {
  console.log('Seeding persona definitions...');

  const files = readdirSync(PERSONAS_DIR).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    try {
      const filePath = join(PERSONAS_DIR, file);
      const raw = readFileSync(filePath, 'utf-8');
      const { data: frontmatter, content } = matter(raw);

      const personaId = uuid(); // Generate valid UUID instead of using string ID

      await db.insert(personaDefinitions).values({
        id: personaId,
        name: frontmatter.name as string,
        personaType: (frontmatter.phase as string) || 'execution',
        model: (frontmatter.model as string) || 'sonnet',
        description: (frontmatter.description as string) || null,
        systemPrompt: content.trim(),
        gatekeeperTransitions: (frontmatter.can_transition as string[]) || [],
        config: {
          personaId: frontmatter.id as string, // Store the original ID for reference
          maxConcurrent: (frontmatter.max_concurrent as number) || 1,
          color: (frontmatter.color as string) || '#6b7280',
          canPush: (frontmatter.can_push as boolean) || false,
          outputsTo: (frontmatter.outputs_to as string) || 'ticket_comments',
          timeoutMinutes: (frontmatter.timeout_minutes as number) || 30,
        },
      }).onConflictDoNothing();

      console.log(`  ✓ ${frontmatter.name} (ID: ${frontmatter.id as string})`);
    } catch (err) {
      console.error(`  ✗ Failed to seed persona ${file}:`, err);
    }
  }

  console.log('\nPersona seeding complete!');
  await pool.end();
}

seedPersonas().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
