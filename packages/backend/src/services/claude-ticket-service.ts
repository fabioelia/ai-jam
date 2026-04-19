import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export interface TicketData {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  storyPoints?: number;
  epic?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  mimeType: string;
  url: string;
}

export interface CodebaseContext {
  files?: Array<{
    path: string;
    content?: string;
    summary?: string;
  }>;
  projectStructure?: string;
  techStack?: string[];
  relatedTickets?: Array<{
    title: string;
    description: string;
  }>;
}

export interface BoardContext {
  projectStructure?: string;
  techStack?: string[];
  featureTitle?: string;
  featureDescription?: string;
  relatedTickets?: Array<{
    title: string;
    description: string;
    status: string;
    priority: string;
  }>;
}

export interface TicketCategorization {
  labels: string[];
  suggestedColumn: 'backlog' | 'in_progress' | 'review' | 'qa' | 'acceptance' | 'done';
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  estimatedStoryPoints?: number;
  confidence: number;
  reasoning: string;
}

export interface StreamCallback {
  (delta: string): void;
}

let anthropicClient: Anthropic | null = null;

function getAIClient(): Anthropic {
  if (!anthropicClient) {
    if (!config.openrouterApiKey) throw new Error('OpenRouter API key not configured');
    anthropicClient = new Anthropic({
      apiKey: config.openrouterApiKey,
      baseURL: config.openrouterBaseUrl,
    });
  }
  return anthropicClient;
}

const SYSTEM_PROMPT = `You are an expert project manager and technical specification writer. Your task is to transform natural language requests into clear, actionable tickets.

## Analysis Process

1. **Identify the request type:**
   - **Feature request**: "Add X", "Implement Y", "Create Z" → Build something new
   - **Bug report**: "Fix X", "Y is broken", "Crashes when" → Fix existing behavior
   - **Improvement**: "Optimize", "Refactor", "Improve" → Enhance existing code

2. **Extract key elements:**
   - **Component/Page**: What part of the application? (e.g., "settings page", "user list", "auth flow")
   - **Behavior/Change**: What should happen? (e.g., "toggle dark mode", "filter results", "redirect after login")
   - **Constraints**: Any specific requirements? (e.g., "real-time", "cache for 5 minutes", "handle 1000+ users")

3. **Determine scope and complexity:**
   - Simple: 1-2 story points (single component, clear requirements)
   - Medium: 3-5 story points (multiple components, some edge cases)
   - Complex: 5-8 story points (significant changes, many edge cases)
   - If >8 story points, break into smaller tickets instead

## Ticket Structure

Create a **concise, action-oriented title** (max 100 characters) following this pattern:
- Feature: \`[Verb] [Component] [Change]\` → "Add dark mode toggle to settings"
- Bug: \`Fix [Component] [Issue]\` → "Fix auth redirect after login"
- Improvement: \`[Action] [Component] for [Benefit]\` → "Optimize dashboard chart loading"

Write a **detailed description** including:
- **Context**: What is the current situation?
- **Goal**: What should be achieved?
- **Success Criteria**: Use EXACT format: \`- [ ] [specific, measurable criterion]\`
  - Each criterion should be testable
  - Include edge cases
  - Use Given-When-Then for complex behavior
- **Technical Considerations**: Performance, security, or integration notes
- **Files/Areas**: Likely files or components to modify (be specific)

## Acceptance Criteria Guidelines

**Good examples:**
- \`- [ ] User can toggle dark mode from settings page\`
- \`- [ ] Preference persists across sessions in localStorage\`
- \`- [ ] Given user is on dashboard, when they click export, then CSV downloads\`
- \`- [ ] Search filters results in real-time (debounced 300ms)\`

**Bad examples:**
- "Make it faster" → "Reduce API response time from 2s to <500ms"
- "Fix everything" → List specific issues
- "Improve UX" → Define what improvement means

## Priority Guidelines

- **Critical**: Security issues, data loss, complete feature failure
- **High**: User-facing bugs, high-value features, performance bottlenecks
- **Medium**: Minor bugs, nice-to-have features, code quality improvements
- **Low**: Cosmetic changes, documentation, low-priority enhancements

## Response Format

Respond ONLY with this JSON:
{
  "title": "Brief, actionable title",
  "description": "### Context\\\\n[current situation]\\\\n\\\\n### Goal\\\\n[what to achieve]\\\\n\\\\n### Success Criteria\\\\n- [ ] [criterion 1]\\\\n- [ ] [criterion 2]\\\\n\\\\n### Technical Considerations\\\\n[notes if any]\\\\n\\\\n### Likely Files\\\\n- [file path 1]\\\\n- [file path 2]",
  "priority": "medium",
  "storyPoints": 3,
  "epic": "Optional epic name"
}

If the request is ambiguous, ask for clarification on specific missing information rather than guessing.`;

const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert project manager and software development lead. Your task is to analyze tickets and provide intelligent categorization and recommendations.

## Board Columns

Understand the workflow:
- **backlog**: New tickets awaiting prioritization and scheduling
- **in_progress**: Currently being worked on
- **review**: Code review pending
- **qa**: Testing and quality assurance
- **acceptance**: Stakeholder acceptance testing
- **done**: Completed and deployed

## Categorization Guidelines

### 1. Labels/Tags

Assign descriptive labels from these categories:
- **Type**: bug, feature, improvement, refactor, documentation
- **Area**: ui, backend, api, database, auth, performance, security
- **Impact**: user-facing, internal, infrastructure
- **Complexity**: simple, moderate, complex

### 2. Column Suggestion

- **backlog**: New tickets, unestimated, awaiting prioritization
- **in_progress**: Only if ticket is actively being developed (not suggested for new tickets)
- **review**: Only if ticket is ready for code review (not suggested for new tickets)
- **qa**: Only if implementation is complete and ready for testing (not suggested for new tickets)
- **acceptance**: Only if QA passed and awaiting stakeholder review (not suggested for new tickets)
- **done**: Only if fully deployed (not suggested for new tickets)

For NEW tickets, always suggest "backlog" as the column.

### 3. Priority

- **critical**: Security issues, data loss, production outages
- **high**: User-facing bugs, high-value features, urgent performance issues
- **medium**: Standard features, improvements, non-urgent bugs
- **low**: Nice-to-haves, documentation, cosmetic changes

### 4. Story Points

- 1-2: Simple, single component, clear requirements
- 3-5: Moderate complexity, multiple components, some edge cases
- 6-8: Complex, significant changes, many edge cases
- Never suggest >8 points - recommend breaking down instead

### 5. Confidence

Rate your categorization confidence (0.0-1.0):
- 0.9-1.0: Very clear, no ambiguity
- 0.7-0.9: Reasonably clear, minor uncertainty
- 0.5-0.7: Some ambiguity, multiple valid interpretations
- 0.3-0.5: Significant ambiguity, more context needed
- 0.0-0.3: Very unclear, insufficient information

## Context Awareness

Use the provided board context to inform categorization:
- Related tickets: Check for patterns in existing similar tickets
- Feature context: Understand the broader feature this ticket belongs to
- Tech stack: Consider technical complexity based on stack

## Response Format

Respond ONLY with this JSON:
{
  "labels": ["bug", "backend", "user-facing"],
  "suggestedColumn": "backlog",
  "suggestedPriority": "high",
  "estimatedStoryPoints": 3,
  "confidence": 0.85,
  "reasoning": "This ticket addresses a user-facing backend bug affecting authentication flow. Similar tickets in the backlog with related scope have been estimated at 3 story points."
}`;

export async function generateTicketFromPrompt(
  userPrompt: string,
  attachments: Attachment[] = [],
  onStream?: StreamCallback,
  codebaseContext?: CodebaseContext
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  // Add codebase context if provided
  if (codebaseContext) {
    const contextParts: Array<{ type: 'text'; text: string }> = [];

    if (codebaseContext.techStack && codebaseContext.techStack.length > 0) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Tech Stack:** ${codebaseContext.techStack.join(', ')}`,
      });
    }

    if (codebaseContext.projectStructure) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Project Structure:**\n\`\`\`\n${codebaseContext.projectStructure}\n\`\`\``,
      });
    }

    if (codebaseContext.files && codebaseContext.files.length > 0) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Relevant Files:**`,
      });

      for (const file of codebaseContext.files) {
        if (file.summary) {
          contextParts.push({
            type: 'text',
            text: `\n- \`${file.path}\`: ${file.summary}`,
          });
        } else if (file.content) {
          contextParts.push({
            type: 'text',
            text: `\n- \`${file.path}\`:\n\`\`\`\n${file.content}\n\`\`\``,
          });
        } else {
          contextParts.push({
            type: 'text',
            text: `\n- \`${file.path}\``,
          });
        }
      }
    }

    if (codebaseContext.relatedTickets && codebaseContext.relatedTickets.length > 0) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Related Tickets:**`,
      });

      for (const ticket of codebaseContext.relatedTickets) {
        contextParts.push({
          type: 'text',
          text: `\n- **${ticket.title}**: ${ticket.description}`,
        });
      }
    }

    if (contextParts.length > 0) {
      messages[0] = {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'text', text: '\n\n---\n\n**Codebase Context (use this for file references):**' },
          ...contextParts,
        ],
      };
    }
  }

  // Add image attachments if present
  if (attachments.length > 0) {
    const images = attachments
      .filter(a => a.type === 'image')
      .map(a => ({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: a.url,
        },
      }));

    if (images.length > 0) {
      messages[0] = {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          ...images,
        ],
      };
    }
  }

  try {
    if (onStream) {
      return await streamTicketGeneration(messages, onStream);
    } else {
      return await generateTicket(messages);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Claude API error: ${message}`);
  }
}

async function streamTicketGeneration(
  messages: Anthropic.MessageParam[],
  onStream: StreamCallback
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  const stream = await getAIClient().messages.stream({
    model: config.aiModel,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages,
  });

  let fullResponse = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta.type === 'text_delta') {
        fullResponse += delta.text;
        onStream(delta.text);
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  const ticket = extractTicketFromResponse(finalMessage);

  return {
    ticket,
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    },
  };
}

async function generateTicket(
  messages: Anthropic.MessageParam[]
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await getAIClient().messages.create({
    model: config.aiModel,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages,
  });

  const ticket = extractTicketFromResponse(response);

  return {
    ticket,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

function extractTicketFromResponse(message: Anthropic.Message): TicketData {
  let jsonText = '';

  for (const block of message.content) {
    if (block.type === 'text') {
      jsonText = block.text;
      break;
    }
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      title: parsed.title || 'Untitled Ticket',
      description: parsed.description || '',
      priority: parsed.priority || 'medium',
      storyPoints: parsed.storyPoints,
      epic: parsed.epic,
    };
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }
}

export async function categorizeTicket(
  ticket: { title: string; description?: string },
  boardContext?: BoardContext
): Promise<{ categorization: TicketCategorization; usage: { inputTokens: number; outputTokens: number } }> {
  let userMessage = `Analyze this ticket and provide categorization:

**Ticket Title:** ${ticket.title}
${ticket.description ? `**Ticket Description:**\n${ticket.description}` : ''}`;

  if (boardContext) {
    const contextParts: Array<{ type: 'text'; text: string }> = [];

    if (boardContext.techStack && boardContext.techStack.length > 0) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Tech Stack:** ${boardContext.techStack.join(', ')}`,
      });
    }

    if (boardContext.projectStructure) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Project Structure:**\n\`\`\`\n${boardContext.projectStructure}\n\`\`\``,
      });
    }

    if (boardContext.featureTitle) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Feature:** ${boardContext.featureTitle}`,
      });
      if (boardContext.featureDescription) {
        contextParts.push({
          type: 'text',
          text: `\n${boardContext.featureDescription}`,
        });
      }
    }

    if (boardContext.relatedTickets && boardContext.relatedTickets.length > 0) {
      contextParts.push({
        type: 'text',
        text: `\n\n**Related Tickets:**`,
      });

      for (const t of boardContext.relatedTickets) {
        contextParts.push({
          type: 'text',
          text: `\n- **${t.title}** (${t.status}, ${t.priority}): ${t.description.substring(0, 100)}...`,
        });
      }
    }

    if (contextParts.length > 0) {
      userMessage += '\n\n---\n\n**Board Context:**';
      for (const part of contextParts) {
        userMessage += part.text;
      }
    }
  }

  try {
    const response = await getAIClient().messages.create({
      model: config.aiModel,
      max_tokens: 1000,
      system: CATEGORIZATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const categorization = extractCategorizationFromResponse(response);

    return {
      categorization,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Claude API error: ${message}`);
  }
}

function extractCategorizationFromResponse(message: Anthropic.Message): TicketCategorization {
  let jsonText = '';

  for (const block of message.content) {
    if (block.type === 'text') {
      jsonText = block.text;
      break;
    }
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      labels: parsed.labels || [],
      suggestedColumn: parsed.suggestedColumn || 'backlog',
      suggestedPriority: parsed.suggestedPriority || 'medium',
      estimatedStoryPoints: parsed.estimatedStoryPoints,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || '',
    };
  } catch {
    throw new Error('Failed to parse Claude categorization response as JSON');
  }
}

export function calculateCost(tokens: { inputTokens: number; outputTokens: number }): number {
  // Claude Sonnet pricing (approximate, update as needed)
  const INPUT_COST_PER_1K = 0.003;
  const OUTPUT_COST_PER_1K = 0.015;

  return (tokens.inputTokens / 1000) * INPUT_COST_PER_1K +
         (tokens.outputTokens / 1000) * OUTPUT_COST_PER_1K;
}
