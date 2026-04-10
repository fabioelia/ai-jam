import 'dotenv/config';
import { db, pool } from './connection.js';
import { users, projects, projectMembers, features, epics, tickets } from './schema.js';
import { hashPassword } from '../auth/password.js';
import { v4 as uuid } from 'uuid';

async function seed() {
  console.log('Seeding database...');

  // 1. Create demo user
  const userId = uuid();
  const passwordHash = await hashPassword('demo1234');

  await db.insert(users).values({
    id: userId,
    email: 'demo@aijam.dev',
    name: 'Demo User',
    passwordHash,
  }).onConflictDoNothing();

  console.log('  Created demo user: demo@aijam.dev / demo1234');

  // 2. Create demo project
  const projectId = uuid();
  await db.insert(projects).values({
    id: projectId,
    name: 'Demo App',
    repoUrl: 'https://github.com/example/demo-app',
    defaultBranch: 'main',
    ownerId: userId,
  }).onConflictDoNothing();

  await db.insert(projectMembers).values({
    projectId,
    userId,
    role: 'owner',
  }).onConflictDoNothing();

  console.log('  Created demo project: Demo App');

  // 3. Create a feature
  const featureId = uuid();
  await db.insert(features).values({
    id: featureId,
    projectId,
    title: 'User Authentication',
    description: 'Implement user registration, login, and session management with JWT tokens.',
    status: 'planned',
    createdBy: userId,
  });

  console.log('  Created feature: User Authentication');

  // 4. Create epics
  const epicAuth = uuid();
  const epicProfile = uuid();

  await db.insert(epics).values([
    {
      id: epicAuth,
      featureId,
      title: 'Auth Core',
      description: 'Core authentication flow',
      sortOrder: 0,
      color: '#6366f1',
    },
    {
      id: epicProfile,
      featureId,
      title: 'User Profile',
      description: 'Profile management',
      sortOrder: 1,
      color: '#10b981',
    },
  ]);

  console.log('  Created epics: Auth Core, User Profile');

  // 5. Create sample tickets across columns
  const ticketData = [
    { title: 'Set up JWT token generation', desc: 'Create JWT access and refresh token utilities with proper expiry and signing.', status: 'done' as const, epic: epicAuth, priority: 'high' as const, sp: 2, order: 0 },
    { title: 'Build registration endpoint', desc: 'POST /auth/register with email validation, password hashing, and duplicate check.', status: 'done' as const, epic: epicAuth, priority: 'high' as const, sp: 3, order: 1 },
    { title: 'Build login endpoint', desc: 'POST /auth/login with credential verification and JWT issuance.', status: 'acceptance' as const, epic: epicAuth, priority: 'high' as const, sp: 3, order: 0, persona: 'acceptance_validator' },
    { title: 'Add refresh token rotation', desc: 'POST /auth/refresh endpoint that rotates refresh tokens on use.', status: 'qa' as const, epic: epicAuth, priority: 'medium' as const, sp: 3, order: 0, persona: 'qa_tester' },
    { title: 'Build auth middleware', desc: 'Fastify plugin that verifies JWT on protected routes and populates request.user.', status: 'review' as const, epic: epicAuth, priority: 'high' as const, sp: 2, order: 0, persona: 'reviewer' },
    { title: 'Password reset flow', desc: 'Email-based password reset with secure token and expiry.', status: 'in_progress' as const, epic: epicAuth, priority: 'medium' as const, sp: 5, order: 0, persona: 'implementer' },
    { title: 'GET /me profile endpoint', desc: 'Return current user profile data from JWT claims.', status: 'in_progress' as const, epic: epicProfile, priority: 'medium' as const, sp: 1, order: 1 },
    { title: 'Update profile endpoint', desc: 'PATCH /users/me to update name, avatar, and preferences.', status: 'backlog' as const, epic: epicProfile, priority: 'low' as const, sp: 2, order: 0 },
    { title: 'Avatar upload', desc: 'File upload endpoint for user avatars with image resize and S3 storage.', status: 'backlog' as const, epic: epicProfile, priority: 'low' as const, sp: 5, order: 1 },
    { title: 'Rate limiting on auth endpoints', desc: 'Add rate limiting to prevent brute-force attacks on login and registration.', status: 'backlog' as const, epic: epicAuth, priority: 'critical' as const, sp: 2, order: 2 },
  ];

  for (const t of ticketData) {
    await db.insert(tickets).values({
      id: uuid(),
      epicId: t.epic,
      featureId,
      projectId,
      title: t.title,
      description: t.desc,
      status: t.status,
      priority: t.priority,
      sortOrder: t.order,
      storyPoints: t.sp,
      assignedPersona: (t as Record<string, unknown>).persona as string || null,
      createdBy: userId,
    });
  }

  console.log(`  Created ${ticketData.length} tickets across all columns`);

  console.log('\nSeed complete!');
  console.log('Login: demo@aijam.dev / demo1234');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
