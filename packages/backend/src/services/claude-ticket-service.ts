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

interface ClaudeCLIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

let anthropicClient: Anthropic | null = null;

function getAIClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.openrouterApiKey,
      baseURL: config.openrouterBaseUrl,
    });
  }
  return anthropicClient;
}

async function callAI({
  prompt,
  systemPrompt,
  model,
}: {
  prompt: string;
  systemPrompt: string;
  model?: string;
}): Promise<ClaudeCLIResponse> {
  const client = getAIClient();
  const modelName = model || config.aiModel;

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  return {
    content,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

async function callAIStream({
  prompt,
  systemPrompt,
  model,
  onDelta,
}: {
  prompt: string;
  systemPrompt: string;
  model?: string;
  onDelta: StreamCallback;
}): Promise<ClaudeCLIResponse> {
  const client = getAIClient();
  const modelName = model || config.aiModel;

  let content = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.messages.stream({
    model: modelName,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      content += chunk.delta.text;
      onDelta(chunk.delta.text);
    }
  }

  const finalMessage = await stream.finalMessage();
  inputTokens = finalMessage.usage.input_tokens;
  outputTokens = finalMessage.usage.output_tokens;

  return { content, usage: { inputTokens, outputTokens } };
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
  let prompt = userPrompt;

  if (codebaseContext) {
    prompt += '\n\n---\n\n**Codebase Context (use this for file references):**';

    if (codebaseContext.techStack && codebaseContext.techStack.length > 0) {
      prompt += `\n\n**Tech Stack:** ${codebaseContext.techStack.join(', ')}`;
    }

    if (codebaseContext.projectStructure) {
      prompt += `\n\n**Project Structure:**\n\`\`\`\n${codebaseContext.projectStructure}\n\`\`\``;
    }

    if (codebaseContext.files && codebaseContext.files.length > 0) {
      prompt += '\n\n**Relevant Files:**';
      for (const file of codebaseContext.files) {
        if (file.summary) {
          prompt += `\n- \`${file.path}\`: ${file.summary}`;
        } else if (file.content) {
          prompt += `\n- \`${file.path}\`:\n\`\`\`\n${file.content}\n\`\`\``;
        } else {
          prompt += `\n- \`${file.path}\``;
        }
      }
    }

    if (codebaseContext.relatedTickets && codebaseContext.relatedTickets.length > 0) {
      prompt += '\n\n**Related Tickets:**';
      for (const ticket of codebaseContext.relatedTickets) {
        prompt += `\n- **${ticket.title}**: ${ticket.description}`;
      }
    }
  }

  if (attachments.length > 0) {
    const images = attachments.filter(a => a.type === 'image').map(a => a.url);
    if (images.length > 0) {
      prompt += '\n\n**Image References:**\n' + images.map(url => `- ${url}`).join('\n');
    }
  }

  try {
    if (onStream) {
      return await streamTicketGeneration(prompt, onStream);
    } else {
      return await generateTicket(prompt);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Claude CLI error: ${message}`);
  }
}

async function streamTicketGeneration(
  prompt: string,
  onStream: StreamCallback
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await callAIStream({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    model: config.aiModel,
    onDelta: onStream,
  });

  const ticket = extractTicketFromResponse(response.content);

  return {
    ticket,
    usage: response.usage,
  };
}

async function generateTicket(
  prompt: string
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await callAI({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    model: config.aiModel,
  });

  const ticket = extractTicketFromResponse(response.content);

  return {
    ticket,
    usage: response.usage,
  };
}

function extractJSONFromMarkdown(content: string): string | null {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

function extractTicketFromResponse(content: string): TicketData {
  try {
    const jsonText = extractJSONFromMarkdown(content);
    if (!jsonText) {
      throw new Error('No JSON found in response');
    }
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
  let prompt = `Analyze this ticket and provide categorization:

**Ticket Title:** ${ticket.title}
${ticket.description ? `**Ticket Description:**\n${ticket.description}` : ''}`;

  if (boardContext) {
    prompt += '\n\n---\n\n**Board Context:**';

    if (boardContext.techStack && boardContext.techStack.length > 0) {
      prompt += `\n\n**Tech Stack:** ${boardContext.techStack.join(', ')}`;
    }

    if (boardContext.projectStructure) {
      prompt += `\n\n**Project Structure:**\n\`\`\`\n${boardContext.projectStructure}\n\`\`\``;
    }

    if (boardContext.featureTitle) {
      prompt += `\n\n**Feature:** ${boardContext.featureTitle}`;
      if (boardContext.featureDescription) {
        prompt += `\n${boardContext.featureDescription}`;
      }
    }

    if (boardContext.relatedTickets && boardContext.relatedTickets.length > 0) {
      prompt += '\n\n**Related Tickets:**';
      for (const t of boardContext.relatedTickets) {
        prompt += `\n- **${t.title}** (${t.status}, ${t.priority}): ${t.description.substring(0, 100)}...`;
      }
    }
  }

  try {
    const response = await callAI({
      prompt,
      systemPrompt: CATEGORIZATION_SYSTEM_PROMPT,
      model: config.aiModel,
    });

    const categorization = extractCategorizationFromResponse(response.content);

    return {
      categorization,
      usage: response.usage,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Claude CLI error: ${message}`);
  }
}

function extractCategorizationFromResponse(content: string): TicketCategorization {
  try {
    const jsonText = extractJSONFromMarkdown(content);
    if (!jsonText) {
      throw new Error('No JSON found in response');
    }
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
  const INPUT_COST_PER_1K = 0.003;
  const OUTPUT_COST_PER_1K = 0.015;

  return (tokens.inputTokens / 1000) * INPUT_COST_PER_1K +
         (tokens.outputTokens / 1000) * OUTPUT_COST_PER_1K;
}
