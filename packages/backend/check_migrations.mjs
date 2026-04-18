import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://aijam:aijam@localhost:5433/aijam'
});

const res = await pool.query(`
  SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 10;
`);
console.log('Recent migrations:');
res.rows.forEach(row => {
  console.log(`  ${row.hash}: ${row.created_at}`);
});
await pool.end();
