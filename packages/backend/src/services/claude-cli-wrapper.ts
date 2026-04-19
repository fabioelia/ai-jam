import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import type { TicketData, TicketCategorization, Attachment, CodebaseContext, BoardContext, StreamCallback } from './claude-ticket-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ClaudeCLIOptions {
  model: string;
  prompt?: string;
  stream?: boolean;
  verbose?: boolean;
  systemPromptFile?: string;
  codebaseContext?: CodebaseContext;
  attachments?: Attachment[];
}

export interface ClaudeCLIReturn<T> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
}

/**
 * Strip markdown code blocks from JSON response
 */
function stripMarkdownJson(text: string): string {
  const fence = '```';
  return text.replace(new RegExp('^' + fence + 'json\\n?'), '').replace(new RegExp('\\n?' + fence + '$'), '').trim();
}

/**
 * Extract JSON from CLI response
 */
function extractJsonFromResponse(response: any): string | null {
  if (response.result) {
    return stripMarkdownJson(response.result);
  }
  if (response.text) {
    return stripMarkdownJson(response.text);
  }
  if (response.content) {
    return stripMarkdownJson(response.content);
  }
  return null;
}

/**
 * Call Claude CLI directly
 */
export async function callClaudeCLI<T = any>(
  options: ClaudeCLIOptions,
  streamCallback?: StreamCallback
): Promise<ClaudeCLIReturn<T>> {
  return new Promise((resolve, reject) => {
    const args = ['--model', options.model, '--dangerously-skip-permissions'];

    // Add output format
    if (options.stream) {
      args.push('--output-format', 'stream-json', '--print', '--include-partial-messages');
      if (options.verbose) {
        args.push('--verbose');
      }
      if (options.prompt) {
        args.push(options.prompt);
      }
    } else {
      args.push('--output-format', 'json');
    }

    // Add system prompt file if provided
    if (options.systemPromptFile) {
      args.push('--append-system-prompt-file', options.systemPromptFile);
    }

    // Add prompt if not streaming
    if (options.prompt && !options.stream) {
      args.push('--print', options.prompt);
    }

    const env = { ...process.env };
    if (!options.stream) {
      env.CI = '1';
    }

    let stdout = '';
    let stderr = '';
    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (options.stream) {
      // Handle streaming response
      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        if (streamCallback) {
          streamCallback(chunk);
        }
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse streaming JSON response
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          const finalLine = lines[lines.length - 1];
          const response = JSON.parse(finalLine);

          const jsonText = extractJsonFromResponse(response);
          if (!jsonText) {
            throw new Error('No JSON found in CLI response');
          }

          const data = JSON.parse(jsonText);
          const modelName = options.model;

          resolve({
            data,
            usage: {
              inputTokens: response.modelUsage?.[modelName]?.inputTokens || 0,
              outputTokens: response.modelUsage?.[modelName]?.outputTokens || 0,
            },
            cost: calculateCost({
              inputTokens: response.modelUsage?.[modelName]?.inputTokens || 0,
              outputTokens: response.modelUsage?.[modelName]?.outputTokens || 0,
            })
          });
        } catch (err) {
          reject(new Error(`Failed to parse streaming response: ${err.message}`));
        }
      });
    } else {
      // Handle non-streaming response
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response = JSON.parse(stdout);
          const jsonText = extractJsonFromResponse(response);
          if (!jsonText) {
            throw new Error('No JSON found in CLI response');
          }

          const data = JSON.parse(jsonText);
          const modelName = options.model;

          resolve({
            data,
            usage: {
              inputTokens: response.modelUsage?.[modelName]?.inputTokens || 0,
              outputTokens: response.modelUsage?.[modelName]?.outputTokens || 0,
            },
            cost: calculateCost({
              inputTokens: response.modelUsage?.[modelName]?.inputTokens || 0,
              outputTokens: response.modelUsage?.[modelName]?.outputTokens || 0,
            })
          });
        } catch (err) {
          reject(new Error(`Failed to parse CLI response: ${err.message}`));
        }
      });
    }
  });
}

/**
 * Generate ticket using Claude CLI
 */
export async function generateTicketFromCLI(
  userPrompt: string,
  options: {
    model: string;
    stream?: boolean;
    onStream?: StreamCallback;
    systemPromptFile?: string;
    codebaseContext?: CodebaseContext;
    attachments?: Attachment[];
  } = {}
): Promise<ClaudeCLIReturn<TicketData>> {
  const prompt = buildPromptWithContext(userPrompt, options.codebaseContext);

  const cliOptions: ClaudeCLIOptions = {
    model: options.model,
    prompt,
    stream: options.stream,
    verbose: options.stream,
    systemPromptFile: options.systemPromptFile,
    attachments: options.attachments,
  };

  return callClaudeCLI<TicketData>(cliOptions, options.onStream);
}

/**
 * Categorize ticket using Claude CLI
 */
export async function categorizeTicketWithCLI(
  ticket: { title: string; description?: string },
  options: {
    model: string;
    boardContext?: BoardContext;
  } = {}
): Promise<ClaudeCLIReturn<TicketCategorization>> {
  const prompt = buildCategorizationPrompt(ticket, options.boardContext);

  const cliOptions: ClaudeCLIOptions = {
    model: options.model,
    prompt,
    stream: false,
    verbose: false,
  };

  return callClaudeCLI<TicketCategorization>(cliOptions);
}

/**
 * Build prompt with codebase context
 */
function buildPromptWithContext(
  userPrompt: string,
  codebaseContext?: CodebaseContext
): string {
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

  return prompt;
}

/**
 * Build categorization prompt
 */
function buildCategorizationPrompt(
  ticket: { title: string; description?: string },
  boardContext?: BoardContext
): string {
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

  return prompt;
}

/**
 * Calculate cost based on token usage
 */
function calculateCost(tokens: { inputTokens: number; outputTokens: number }): number {
  const INPUT_COST_PER_1K = 0.003;
  const OUTPUT_COST_PER_1K = 0.015;

  return (tokens.inputTokens / 1000) * INPUT_COST_PER_1K +
         (tokens.outputTokens / 1000) * OUTPUT_COST_PER_1K;
}