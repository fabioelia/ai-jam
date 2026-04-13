import 'dotenv/config';
import { db, pool } from './connection.js';
import { systemPrompts } from './schema.js';
import { v4 as uuid } from 'uuid';

async function seedSystemPrompts() {
  console.log('Seeding default system prompts...');

  const defaultPrompts = [
    {
      slug: 'default-coding-style',
      name: 'Default Coding Style',
      description: 'Standard coding conventions and style guidelines',
      content: `## Coding Standards

- Follow existing code patterns and conventions in the project
- Write clean, readable code with meaningful variable names
- Use TypeScript for type safety
- Add comments only where logic is non-obvious
- Ensure all code follows the existing file structure
- Write tests for new functionality
- Follow the project's linting rules

## Code Quality

- Ensure no console.log statements in production code
- Handle errors gracefully with appropriate error messages
- Use async/await for asynchronous operations
- Keep functions focused and single-purpose
- Avoid deep nesting by extracting helper functions

## Testing

- Write unit tests for business logic
- Test edge cases and error conditions
- Ensure tests are maintainable and readable`,
    },
    {
      slug: 'default-communication-style',
      name: 'Default Communication Style',
      description: 'Guidelines for how agents should communicate',
      content: `## Communication Guidelines

- Be direct and concise in your responses
- Use technical terminology accurately
- Provide code examples when relevant
- Explain the reasoning behind your decisions
- Acknowledge constraints and limitations

## Reporting

- Clearly state what was done
- Highlight any assumptions made
- Note any potential issues or concerns
- Suggest next steps when appropriate

## Questions

- Ask clarifying questions when requirements are unclear
- Confirm understanding before proceeding with implementation
- State assumptions made when information is incomplete`,
    },
    {
      slug: 'default-architecture-principles',
      name: 'Default Architecture Principles',
      description: 'Architectural guidelines for the project',
      content: `## Architecture Principles

- Follow modular design patterns
- Separate concerns between layers
- Use dependency injection where appropriate
- Design for testability from the start
- Consider performance implications of design decisions

## Design Patterns

- Use established patterns from the codebase
- Maintain consistency with existing architecture
- Prefer composition over inheritance
- Keep business logic separate from presentation

## Scalability

- Design for horizontal scaling
- Use caching strategies where appropriate
- Optimize database queries
- Consider async processing for long operations`,
    },
    {
      slug: 'default-security-principles',
      name: 'Default Security Principles',
      description: 'Security guidelines for the project',
      content: `## Security Guidelines

- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Sanitize data before rendering in HTML
- Implement proper authentication and authorization
- Use HTTPS for all external communications
- Never expose sensitive information in error messages

## Data Protection

- Encrypt sensitive data at rest
- Use secure cookie flags
- Implement rate limiting
- Log security-relevant events
- Follow OWASP guidelines

## Authorization

- Check permissions before accessing resources
- Use role-based access control
- Implement principle of least privilege
- Log access denials for monitoring`,
    },
    {
      slug: 'default-testing-principles',
      name: 'Default Testing Principles',
      description: 'Testing guidelines and best practices',
      content: `## Testing Guidelines

- Write tests before writing production code
- Test both happy paths and edge cases
- Mock external dependencies
- Keep tests independent and fast
- Use descriptive test names

## Test Coverage

- Aim for high code coverage
- Test critical paths thoroughly
- Include integration tests for key workflows
- Test error conditions and recovery

## Test Maintenance

- Keep tests updated with code changes
- Remove tests for deprecated features
- Refactor test code for readability
- Document complex test scenarios`,
    },
  ];

  for (const prompt of defaultPrompts) {
    try {
      await db.insert(systemPrompts).values({
        id: uuid(),
        projectId: null, // null means global default
        slug: prompt.slug,
        name: prompt.name,
        description: prompt.description,
        content: prompt.content,
        isDefault: 1,
      }).onConflictDoNothing();

      console.log(`  ✓ ${prompt.name} (${prompt.slug})`);
    } catch (err) {
      console.error(`  ✗ Failed to seed system prompt ${prompt.slug}:`, err);
    }
  }

  console.log('\nSystem prompt seeding complete!');
  await pool.end();
}

seedSystemPrompts().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
