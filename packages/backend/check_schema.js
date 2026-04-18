const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://aijam:aijam@localhost:5433/aijam'
});

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'projects' 
  ORDER BY ordinal_position;
`).then(res => {
  console.log('Projects table columns:');
  res.rows.forEach(row => {
    console.log(`  ${row.column_name}: ${row.data_type}`);
  });
  pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
