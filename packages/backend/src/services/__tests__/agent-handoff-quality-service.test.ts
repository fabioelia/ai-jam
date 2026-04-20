import { describe, it, expect } from 'vitest';
import { scoreHandoff, gradeFromScore } from '../agent-handoff-quality-service.js';

describe('scoreHandoff', () => {
  it('returns score <= 60 for empty notes (AC2)', () => {
    const { score } = scoreHandoff('');
    expect(score).toBeLessThanOrEqual(60);
  });

  it('returns score >= 70 for rich notes >= 100 chars with context (AC2)', () => {
    const richNotes = 'Implemented the auth flow in src/auth/token.ts. Next steps: update the refresh logic. Acceptance criteria: token expires after 1h and refresh works correctly. Files: src/auth/token.ts, src/middleware/auth.ts';
    const { score } = scoreHandoff(richNotes);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('deducts 40 for completely missing notes', () => {
    const { score, issues } = scoreHandoff('');
    expect(score).toBe(60);
    expect(issues.some((i) => i.category === 'missing-context')).toBe(true);
  });

  it('deducts 20 for notes < 50 chars', () => {
    const { score, issues } = scoreHandoff('do this thing ok');
    expect(score).toBeLessThan(100);
    expect(issues.some((i) => i.category === 'missing-context')).toBe(true);
  });

  it('deducts 15 for missing acceptance criteria', () => {
    const { score, issues } = scoreHandoff('Please implement the login feature. Next steps: write the handler. See src/auth.ts for reference.');
    expect(issues.some((i) => i.category === 'no-acceptance-criteria')).toBe(true);
    expect(score).toBeLessThan(100);
  });

  it('returns no missing-artifacts issue when file path present', () => {
    const { issues } = scoreHandoff('Update src/components/Login.tsx to add validation. Next steps: run tests. Acceptance criteria: form validates email format. Files: src/components/Login.tsx');
    expect(issues.some((i) => i.category === 'missing-artifacts')).toBe(false);
  });
});

describe('gradeFromScore', () => {
  it('maps 80-100 to exemplary (AC3)', () => {
    expect(gradeFromScore(100)).toBe('exemplary');
    expect(gradeFromScore(80)).toBe('exemplary');
  });

  it('maps 60-79 to proficient (AC3)', () => {
    expect(gradeFromScore(79)).toBe('proficient');
    expect(gradeFromScore(60)).toBe('proficient');
  });

  it('maps 40-59 to adequate (AC3)', () => {
    expect(gradeFromScore(59)).toBe('adequate');
    expect(gradeFromScore(40)).toBe('adequate');
  });

  it('maps 0-39 to deficient (AC3)', () => {
    expect(gradeFromScore(39)).toBe('deficient');
    expect(gradeFromScore(0)).toBe('deficient');
  });
});
