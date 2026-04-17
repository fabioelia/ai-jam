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

export interface StreamCallback {
  (delta: string): void;
}

const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

const SYSTEM_PROMPT = `You are an expert project manager and technical specification writer. Your task is to help users create clear, actionable tickets by extracting structured ticket information from their natural language description.

When given a user's request:
1. Analyze the request to understand what needs to be done
2. Create a concise, action-oriented ticket title (max 100 characters)
3. Write a detailed description including:
   - Clear acceptance criteria
   - Technical considerations if applicable
   - Any edge cases to consider
4. Assign an appropriate priority (critical/high/medium/low) based on urgency
5. Estimate story points if applicable (1, 2, 3, 5, 8, 13)

Respond ONLY with a JSON object in this format:
{
  "title": "Brief ticket title",
  "description": "Detailed description with acceptance criteria",
  "priority": "medium",
  "storyPoints": 3,
  "epic": "Optional epic name if context suggests it"
}

If the user's request is unclear, ask for clarification instead of making up details.`;

export async function generateTicketFromPrompt(
  userPrompt: string,
  attachments: Attachment[] = [],
  onStream?: StreamCallback
): Promise<{ ticket: TicketData; usage: { inputTokens: number; outputTokens: number } }> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

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
  if (!anthropic) throw new Error('Anthropic API not configured');

  const stream = await anthropic.messages.stream({
    model: config.claudeModel,
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
  if (!anthropic) throw new Error('Anthropic API not configured');

  const response = await anthropic.messages.create({
    model: config.claudeModel,
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

export function calculateCost(tokens: { inputTokens: number; outputTokens: number }): number {
  // Claude Sonnet pricing (approximate, update as needed)
  const INPUT_COST_PER_1K = 0.003;
  const OUTPUT_COST_PER_1K = 0.015;

  return (tokens.inputTokens / 1000) * INPUT_COST_PER_1K +
         (tokens.outputTokens / 1000) * OUTPUT_COST_PER_1K;
}
