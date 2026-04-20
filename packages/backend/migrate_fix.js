import { db } from './src/db/connection.ts';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Running migration...');
    
    // Fix the status column type conversion in agent_sessions
    console.log('Checking agent_sessions status column...');
    const checkResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sessions' 
      AND column_name = 'status'
    `);
    
    const currentType = checkResult[0]?.data_type;
    console.log('Current status column type:', currentType);
    
    if (currentType === 'character varying') {
      console.log('Fixing status column type...');
      
      // First, update any invalid status values
      await db.execute(sql`
        UPDATE agent_sessions 
        SET status = 'pending' 
        WHERE status NOT IN ('pending', 'queued', 'spawning', 'running', 'paused', 'completed', 'failed')
      `);
      
      // Then convert the column type
      await db.execute(sql`
        ALTER TABLE agent_sessions 
        ALTER COLUMN status TYPE agent_session_status 
        USING status::agent_session_status
      `);
      console.log('Status column converted successfully');
    } else {
      console.log('Status column is already the correct type');
    }
    
    // Drop the dependencies column from tickets
    console.log('Dropping dependencies column from tickets...');
    await db.execute(sql`ALTER TABLE tickets DROP COLUMN IF EXISTS dependencies`);
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
