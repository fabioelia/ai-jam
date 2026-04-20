// WIP stub: full implementation pending. Imports referenced from
// src/routes/tickets.ts but the service file was never created. Stubbed
// so the server boots; calls throw at runtime until implemented.

export interface TicketData {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  storyPoints?: number | null;
}

export interface RelatedTicketSummary {
  title: string;
  description: string;
  status: string;
  priority: string;
}

export interface BoardContext {
  featureTitle?: string;
  featureDescription?: string;
  relatedTickets?: RelatedTicketSummary[];
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CategorizationResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  storyPoints: number;
  rationale: string;
}

function notImplemented(): never {
  throw new Error('claude-ticket-service is not implemented yet');
}

export async function generateTicketFromPrompt(
  _userPrompt: string,
  _attachments: unknown[],
  _onDelta?: (delta: string) => void,
  _codebaseContext?: unknown,
): Promise<{ ticket: TicketData; usage: ClaudeUsage }> {
  notImplemented();
}

export function calculateCost(_usage: ClaudeUsage): number {
  return 0;
}

export async function categorizeTicket(
  _input: { title: string; description?: string },
  _boardContext?: BoardContext,
): Promise<{ categorization: CategorizationResult; usage: ClaudeUsage }> {
  notImplemented();
}
