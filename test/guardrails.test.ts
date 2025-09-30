import { describe, it, expect } from 'vitest';
import { checkCandidate } from '../src/guardrails.js';

describe('guardrails', () => {
  it('does not flag long titles (length handled upstream by AI prompt)', () => {
    const errs = checkCandidate({
      title: 'a'.repeat(80),
      score: 50,
    });
    expect(errs.some((e) => e.includes('exceeds'))).toBe(false);
  });

  it('flags non-conventional when required', () => {
    const errs = checkCandidate({
      title: 'Add something',
      score: 50,
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('accepts gitmoji colon form', () => {
    const errs = checkCandidate({
      title: '✨: add feature',
      score: 80,
    });
    expect(errs.length).toBe(0);
  });

  it('accepts gitmoji + type form', () => {
    const errs = checkCandidate({
      title: '✨ feat: add feature',
      score: 80,
    });
    expect(errs.length).toBe(0);
  });
});
