import { describe, it, expect } from 'vitest';
import { normalizeConventionalTitle } from '../src/guardrails.js';

describe('normalizeConventionalTitle', () => {
  it('adds chore type when missing', () => {
    expect(normalizeConventionalTitle('Add feature X.')).toBe('chore: add feature X');
  });
  it('strips trailing period and lowercases subject', () => {
    expect(normalizeConventionalTitle('Feat: Add Stuff.')).toBe('feat: add Stuff');
  });
  it('preserves scope and enforces lowercase subject start', () => {
    expect(normalizeConventionalTitle('FIX(API): Crash on start')).toBe('fix(API): crash on start');
  });
  it('preserves a single leading emoji and normalizes afterward', () => {
    expect(normalizeConventionalTitle('✨ Feat: Add X.')).toBe('✨ feat: add X');
  });
});
