import { describe, it, expect } from 'vitest';
import { scoreHandoffContext, classifyRole } from '../agent-handoff-quality-service.js';

describe('scoreHandoffContext', () => {
  it('returns base score 20 for bare handoff', () => {
    expect(scoreHandoffContext({})).toBe(20);
  });

  it('adds +40 for description > 100 chars', () => {
    const longDesc = 'x'.repeat(101);
    expect(scoreHandoffContext({ description: longDesc })).toBe(60);
  });

  it('adds +20 for instructions field', () => {
    expect(scoreHandoffContext({ instructions: 'do this' })).toBe(40);
  });

  it('adds +20 for content containing "instruction"', () => {
    expect(scoreHandoffContext({ content: 'some instruction here' })).toBe(40);
  });

  it('adds +10 for priority', () => {
    expect(scoreHandoffContext({ priority: 'high' })).toBe(30);
  });

  it('adds +10 for acceptanceCriteria', () => {
    expect(scoreHandoffContext({ acceptanceCriteria: 'must pass' })).toBe(30);
  });

  it('caps at 100', () => {
    const score = scoreHandoffContext({
      description: 'x'.repeat(101),
      instructions: 'yes',
      priority: 'high',
      acceptanceCriteria: 'done',
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('classifyRole', () => {
  it('returns initiator when sent > received*2 and sent >= 3', () => {
    expect(classifyRole(6, 1)).toBe('initiator');
    expect(classifyRole(3, 0)).toBe('initiator');
  });

  it('returns receiver when received > sent*2 and received >= 3', () => {
    expect(classifyRole(1, 6)).toBe('receiver');
    expect(classifyRole(0, 3)).toBe('receiver');
  });

  it('returns collaborator when sent >= 2 and received >= 2', () => {
    expect(classifyRole(2, 2)).toBe('collaborator');
    expect(classifyRole(3, 2)).toBe('collaborator');
  });

  it('returns isolated otherwise', () => {
    expect(classifyRole(0, 0)).toBe('isolated');
    expect(classifyRole(1, 1)).toBe('isolated');
  });
});
