import { db } from './src/db/connection.ts';
import { sql } from 'drizzle-orm';

async function checkColumns() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tickets'
      ORDER BY ordinal_position
    `);
    
    console.log('Result type:', typeof result);
    console.log('Result:', result);
    
    // Check if result is an array or has rows
    const rows = Array.isArray(result) ? result : (result?.rows || []);
    
    console.log('\nTickets table columns:');
    rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check specifically for dependencies column
    const hasDependencies = rows.some(col => col.column_name === 'dependencies');
    console.log(`\nHas 'dependencies' column: ${hasDependencies}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

checkColumns();
