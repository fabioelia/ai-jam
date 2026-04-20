// Test script for dependency service circular dependency validation
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgresql://aijam:aijam@localhost:5433/aijam' });

// Mock adjacency list for testing
const adjacency = new Map();

function hasCycle(node, visited = new Set(), recursionStack = new Set()) {
  if (recursionStack.has(node)) return true;
  if (visited.has(node)) return false;

  visited.add(node);
  recursionStack.add(node);

  const deps = adjacency.get(node) || [];
  for (const dep of deps) {
    if (hasCycle(dep, visited, recursionStack)) return true;
  }

  recursionStack.delete(node);
  return false;
}

async function runTests() {
  console.log('\n=== CIRCULAR DEPENDENCY VALIDATION TESTS ===\n');

  const tests = [
    {
      name: 'Test 1: No circular dependency (A -> B)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-b']);
        adjacency.set('ticket-b', []);
      },
      expected: false,
    },
    {
      name: 'Test 2: No circular dependency (A -> B -> C)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-b']);
        adjacency.set('ticket-b', ['ticket-c']);
        adjacency.set('ticket-c', []);
      },
      expected: false,
    },
    {
      name: 'Test 3: Simple circular dependency (A -> B -> A)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-b']);
        adjacency.set('ticket-b', ['ticket-a']);
      },
      expected: true,
    },
    {
      name: 'Test 4: Complex circular dependency (A -> B -> C -> A)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-b']);
        adjacency.set('ticket-b', ['ticket-c']);
        adjacency.set('ticket-c', ['ticket-a']);
      },
      expected: true,
    },
    {
      name: 'Test 5: No dependencies',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', []);
      },
      expected: false,
    },
    {
      name: 'Test 6: Self-loop (A -> A)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-a']);
      },
      expected: true,
    },
    {
      name: 'Test 7: Diamond pattern (A -> B, C; B -> D; C -> D)',
      setup: async () => {
        adjacency.clear();
        adjacency.set('ticket-a', ['ticket-b', 'ticket-c']);
        adjacency.set('ticket-b', ['ticket-d']);
        adjacency.set('ticket-c', ['ticket-d']);
        adjacency.set('ticket-d', []);
      },
      expected: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    await test.setup();
    const result = hasCycle('ticket-a');
    const success = result === test.expected;

    if (success) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`✗ ${test.name}`);
      console.log(`  Expected: ${test.expected}, Got: ${result}`);
      failed++;
    }
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

  await pool.end();
  return { passed, failed };
}

// Test with real database
async function testWithRealDatabase() {
  console.log('\n=== INTEGRATION TESTS WITH REAL DATABASE ===\n');

  // Create test tickets
  const testTickets = await pool.query(`
    WITH new_tickets AS (
      INSERT INTO tickets (id, feature_id, project_id, title, status, priority, created_by, dependencies)
      VALUES
        ('test-dep-1', (SELECT id FROM features LIMIT 1), (SELECT id FROM projects LIMIT 1), 'Test Dep 1', 'backlog', 'medium', (SELECT id FROM users LIMIT 1), ARRAY[]::uuid[]),
        ('test-dep-2', (SELECT id FROM features LIMIT 1), (SELECT id FROM projects LIMIT 1), 'Test Dep 2', 'backlog', 'medium', (SELECT id FROM users LIMIT 1), ARRAY[]::uuid[]),
        ('test-dep-3', (SELECT id FROM features LIMIT 1), (SELECT id FROM projects LIMIT 1), 'Test Dep 3', 'backlog', 'medium', (SELECT id FROM users LIMIT 1), ARRAY[]::uuid[])
      ON CONFLICT (id) DO NOTHING
      RETURNING id, title
    )
    SELECT * FROM new_tickets
  `);

  console.log('Created test tickets:');
  testTickets.rows.forEach(t => console.log(`  ${t.id}: ${t.title}`));

  // Test 1: Valid dependency (test-dep-1 -> test-dep-2)
  console.log('\nTest 1: Setting valid dependency (test-dep-1 -> test-dep-2)');
  try {
    await pool.query(`UPDATE tickets SET dependencies = ARRAY['test-dep-2']::uuid[] WHERE id = 'test-dep-1'`);
    console.log('✓ Valid dependency set successfully');

    const tickets = await pool.query(`SELECT id, dependencies FROM tickets WHERE id = 'test-dep-1'`);
    console.log(`  test-dep-1 dependencies: ${JSON.stringify(tickets.rows[0]?.dependencies)}`);
  } catch (err) {
    console.log(`✗ Failed: ${err.message}`);
  }

  // Test 2: Add another valid dependency (test-dep-2 -> test-dep-3)
  console.log('\nTest 2: Setting valid dependency (test-dep-2 -> test-dep-3)');
  try {
    await pool.query(`UPDATE tickets SET dependencies = ARRAY['test-dep-3']::uuid[] WHERE id = 'test-dep-2'`);
    console.log('✓ Valid dependency set successfully');

    const tickets = await pool.query(`SELECT id, dependencies FROM tickets WHERE id = 'test-dep-2'`);
    console.log(`  test-dep-2 dependencies: ${JSON.stringify(tickets.rows[0]?.dependencies)}`);
  } catch (err) {
    console.log(`✗ Failed: ${err.message}`);
  }

  // Test 3: Try to create circular dependency (test-dep-3 -> test-dep-1)
  console.log('\nTest 3: Attempting circular dependency (test-dep-3 -> test-dep-1)');
  console.log('  Current chain: test-dep-1 -> test-dep-2 -> test-dep-3');
  console.log('  Attempting: test-dep-3 -> test-dep-1 (creates cycle!)');
  console.log('  Note: Database doesn\'t enforce this - should be caught by service layer');

  // In real implementation, this would be caught by validateNoCircularDependencies
  // For now, we're just showing the data can be stored
  console.log('  (Service layer validation needed)');

  // Clean up test tickets
  await pool.query(`DELETE FROM tickets WHERE id LIKE 'test-dep-%'`);
  console.log('\n✓ Test tickets cleaned up');
}

runTests().then(results => {
  console.log('\nCircular dependency algorithm test complete.');
  return testWithRealDatabase();
}).then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
