import { describe, it, expect } from 'vitest';
import {
  computeNetwork,
  computeCollaborationStrength,
  FALLBACK_INSIGHT,
  type HandoffNote,
  type TicketRecord,
} from '../agent-collaboration-network-service.js';

const PROJECT_ID = 'test-project';

describe('agent-collaboration-network-service', () => {
  it('1. Returns empty network when no handoffs', () => {
    const tickets: TicketRecord[] = [{ id: 't1', assignedPersona: 'Alice' }];
    const notes: HandoffNote[] = [];
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);

    expect(result.totalHandoffsAnalyzed).toBe(0);
    expect(result.totalAgentsInNetwork).toBe(0);
    expect(result.mostCollaborativeAgent).toBeNull();
    expect(result.allLinks).toHaveLength(0);
    expect(result.strongLinks).toHaveLength(0);
    expect(result.isolatedAgents).toContain('Alice');
  });

  it('2. Groups by (fromAgent, toAgent) pair correctly', () => {
    const tickets: TicketRecord[] = [{ id: 't1', assignedPersona: 'Bob' }];
    const notes: HandoffNote[] = [
      { ticketId: 't1', handoffFrom: 'Alice', handoffTo: 'Bob' },
      { ticketId: 't1', handoffFrom: 'Alice', handoffTo: 'Bob' },
      { ticketId: 't1', handoffFrom: 'Bob', handoffTo: 'Alice' },
    ];
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);

    const aliceBob = result.allLinks.find((l) => l.fromAgent === 'Alice' && l.toAgent === 'Bob');
    const bobAlice = result.allLinks.find((l) => l.fromAgent === 'Bob' && l.toAgent === 'Alice');

    expect(aliceBob).toBeDefined();
    expect(aliceBob?.handoffCount).toBe(2);
    expect(bobAlice).toBeDefined();
    expect(bobAlice?.handoffCount).toBe(1);
  });

  it('3. collaborationStrength >= 5 = strong', () => {
    expect(computeCollaborationStrength(5)).toBe('strong');
    expect(computeCollaborationStrength(10)).toBe('strong');

    const tickets: TicketRecord[] = [];
    const notes: HandoffNote[] = Array.from({ length: 5 }, () => ({
      ticketId: 't1',
      handoffFrom: 'Alice',
      handoffTo: 'Bob',
    }));
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);
    expect(result.allLinks[0].collaborationStrength).toBe('strong');
    expect(result.strongLinks).toHaveLength(1);
  });

  it('4. collaborationStrength >= 2 = moderate', () => {
    expect(computeCollaborationStrength(2)).toBe('moderate');
    expect(computeCollaborationStrength(4)).toBe('moderate');

    const tickets: TicketRecord[] = [];
    const notes: HandoffNote[] = Array.from({ length: 3 }, () => ({
      ticketId: 't1',
      handoffFrom: 'Alice',
      handoffTo: 'Bob',
    }));
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);
    expect(result.allLinks[0].collaborationStrength).toBe('moderate');
  });

  it('5. collaborationStrength < 2 = weak', () => {
    expect(computeCollaborationStrength(1)).toBe('weak');
    expect(computeCollaborationStrength(0)).toBe('weak');

    const tickets: TicketRecord[] = [];
    const notes: HandoffNote[] = [
      { ticketId: 't1', handoffFrom: 'Alice', handoffTo: 'Bob' },
    ];
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);
    expect(result.allLinks[0].collaborationStrength).toBe('weak');
  });

  it('6. isolatedAgents = agents in tickets with 0 handoffs', () => {
    const tickets: TicketRecord[] = [
      { id: 't1', assignedPersona: 'Alice' },
      { id: 't2', assignedPersona: 'Charlie' },
    ];
    const notes: HandoffNote[] = [
      { ticketId: 't1', handoffFrom: 'Alice', handoffTo: 'Bob' },
    ];
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);
    // Charlie has tickets but no handoffs
    expect(result.isolatedAgents).toContain('Charlie');
    // Alice is in handoffs (as fromAgent), so not isolated
    expect(result.isolatedAgents).not.toContain('Alice');
  });

  it('7. mostCollaborativeAgent = highest combined total', () => {
    const tickets: TicketRecord[] = [];
    const notes: HandoffNote[] = [
      { ticketId: 't1', handoffFrom: 'Alice', handoffTo: 'Bob' },
      { ticketId: 't2', handoffFrom: 'Alice', handoffTo: 'Charlie' },
      { ticketId: 't3', handoffFrom: 'Alice', handoffTo: 'Bob' },
      // Alice: 3 from, Bob: 2 to, Charlie: 1 to
      // Alice total = 3, Bob total = 2, Charlie total = 1
    ];
    const result = computeNetwork(PROJECT_ID, tickets, notes, FALLBACK_INSIGHT);
    expect(result.mostCollaborativeAgent).toBe('Alice');
  });

  it('8. networkInsight falls back when OpenRouter unavailable', () => {
    // computeNetwork itself always returns the insight passed in.
    // If AI call fails in analyzeCollaborationNetwork, FALLBACK_INSIGHT is used.
    const result = computeNetwork(PROJECT_ID, [], [], FALLBACK_INSIGHT);
    expect(result.networkInsight).toBe(FALLBACK_INSIGHT);
  });
});
