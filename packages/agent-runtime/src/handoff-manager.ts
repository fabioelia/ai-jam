import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

export interface HandoffDocument {
  ticketId: string;
  fromPersona: string;
  toPersona: string;
  summary: string;
  directive: string;
  findings: HandoffFinding[];
  artifacts: HandoffArtifact[];
}

export interface HandoffFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  category: string;
  description: string;
  fileRef?: string;
}

export interface HandoffArtifact {
  type: 'pr' | 'comment' | 'file' | 'test_report';
  ref: string;
  description: string;
}

/**
 * Manages inter-persona handoffs on tickets.
 *
 * When persona A completes and signals NEXT_PERSONA=B:
 * 1. Builds a handoff document from A's output
 * 2. Saves it as a ticket note via the backend API
 * 3. Provides the handoff context to persona B when spawned
 */
export class HandoffManager extends EventEmitter {
  private backendUrl: string;
  private authToken: string;

  constructor(backendUrl: string, authToken: string) {
    super();
    this.backendUrl = backendUrl;
    this.authToken = authToken;
  }

  /**
   * Build a handoff document from session output.
   */
  buildHandoff(
    ticketId: string,
    fromPersona: string,
    toPersona: string,
    output: string,
    summary: string,
  ): HandoffDocument {
    const findings = this.extractFindings(output);
    const artifacts = this.extractArtifacts(output);

    // Build a directive based on the target persona
    const directive = this.buildDirective(toPersona, summary, findings);

    return {
      ticketId,
      fromPersona,
      toPersona,
      summary,
      directive,
      findings,
      artifacts,
    };
  }

  /**
   * Save a handoff document as a ticket note in the backend.
   */
  async saveHandoff(handoff: HandoffDocument): Promise<void> {
    const content = this.formatHandoffNote(handoff);

    try {
      await fetch(`${this.backendUrl}/api/tickets/${handoff.ticketId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          authorType: 'agent',
          authorId: handoff.fromPersona,
          content,
          handoffFrom: handoff.fromPersona,
          handoffTo: handoff.toPersona,
          fileUris: handoff.artifacts
            .filter((a) => a.type === 'file')
            .map((a) => a.ref),
        }),
      });
    } catch (err) {
      console.error(`[handoff-manager] Failed to save handoff note:`, err);
    }

    this.emit('handoff:saved', handoff);
  }

  /**
   * Get handoff notes for a ticket to provide as context.
   */
  async getHandoffHistory(ticketId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/tickets/${ticketId}/notes`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) return [];
      const notes = await response.json() as Array<{ content: string; handoffFrom: string; handoffTo: string; createdAt: string }>;
      return notes
        .filter((n) => n.handoffFrom || n.handoffTo)
        .map((n) => n.content);
    } catch {
      return [];
    }
  }

  private extractFindings(output: string): HandoffFinding[] {
    const findings: HandoffFinding[] = [];

    // Look for structured finding patterns in output
    const findingPattern = /(?:FINDING|ISSUE|BUG|WARNING):\s*\[(\w+)\]\s*(?:\[(\w+)\])?\s*(.+)/gi;
    let match;
    while ((match = findingPattern.exec(output)) !== null) {
      findings.push({
        severity: this.normalizeSeverity(match[1]),
        category: match[2] || 'general',
        description: match[3].trim(),
      });
    }

    return findings;
  }

  private extractArtifacts(output: string): HandoffArtifact[] {
    const artifacts: HandoffArtifact[] = [];

    // Look for PR references
    const prPattern = /(?:PR|pull request)[:\s]*#?(\d+|https?:\/\/\S+)/gi;
    let match;
    while ((match = prPattern.exec(output)) !== null) {
      artifacts.push({
        type: 'pr',
        ref: match[1],
        description: 'Pull request',
      });
    }

    // Look for file references
    const filePattern = /(?:modified|changed|created|updated)\s+(?:file\s+)?[`"]?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)[`"]?/gi;
    while ((match = filePattern.exec(output)) !== null) {
      artifacts.push({
        type: 'file',
        ref: match[1],
        description: `Modified file`,
      });
    }

    return artifacts;
  }

  private buildDirective(toPersona: string, summary: string, findings: HandoffFinding[]): string {
    const highFindings = findings.filter((f) => f.severity === 'high');

    switch (toPersona) {
      case 'reviewer':
        return `Review the implementation described below. Focus on code quality, completeness against acceptance criteria, and any issues flagged.${
          highFindings.length > 0
            ? ` Pay special attention to ${highFindings.length} high-severity findings.`
            : ''
        }`;
      case 'qa_tester':
        return `Test the implementation described below. Run the test suite, verify acceptance criteria, and check for regressions.`;
      case 'acceptance_validator':
        return `Perform final acceptance validation. Verify all original requirements and acceptance criteria are met.`;
      case 'implementer':
        return `Address the feedback below and update the implementation. ${summary}`;
      default:
        return `Continue work on this ticket. Previous persona summary: ${summary}`;
    }
  }

  private formatHandoffNote(handoff: HandoffDocument): string {
    const sections: string[] = [];

    sections.push(`## Handoff: ${handoff.fromPersona} → ${handoff.toPersona}`);
    sections.push('');
    sections.push(`### Summary`);
    sections.push(handoff.summary);
    sections.push('');
    sections.push(`### Directive`);
    sections.push(handoff.directive);

    if (handoff.findings.length > 0) {
      sections.push('');
      sections.push(`### Findings`);
      for (const f of handoff.findings) {
        sections.push(`- **[${f.severity}]** ${f.category}: ${f.description}${f.fileRef ? ` (${f.fileRef})` : ''}`);
      }
    }

    if (handoff.artifacts.length > 0) {
      sections.push('');
      sections.push(`### Artifacts`);
      for (const a of handoff.artifacts) {
        sections.push(`- ${a.type}: ${a.ref} — ${a.description}`);
      }
    }

    return sections.join('\n');
  }

  private normalizeSeverity(raw: string): 'high' | 'medium' | 'low' | 'info' {
    const lower = raw.toLowerCase();
    if (['high', 'critical', 'error'].includes(lower)) return 'high';
    if (['medium', 'warning', 'warn'].includes(lower)) return 'medium';
    if (['low', 'minor'].includes(lower)) return 'low';
    return 'info';
  }
}
