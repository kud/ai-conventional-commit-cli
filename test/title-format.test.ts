import { describe, it, expect } from 'vitest';
import { formatCommitTitle } from '../src/title-format.js';

describe('formatCommitTitle', () => {
  it('keeps standard conventional title when gitmoji disabled', () => {
    expect(formatCommitTitle('feat(core): add x', { allowGitmoji: false, mode: 'standard' })).toBe(
      'feat(core): add x',
    );
  });

  it('adds emoji + type in gitmoji mode', () => {
    const out = formatCommitTitle('feat: add thing', { allowGitmoji: true, mode: 'gitmoji' });
    expect(out.startsWith('✨ feat:')).toBe(true);
  });

  it('converts type to emoji only in pure mode', () => {
    const out = formatCommitTitle('feat: add thing', { allowGitmoji: true, mode: 'gitmoji-pure' });
    expect(out).toMatch(/^✨: add thing/);
    expect(out.includes('feat:')).toBe(false);
  });

  it('strips type when already emoji + type to pure mode', () => {
    const out = formatCommitTitle('✨ feat: add thing', {
      allowGitmoji: true,
      mode: 'gitmoji-pure',
    });
    expect(out).toBe('✨: add thing');
  });

  it('fallbacks to chore when no type provided (gitmoji mode)', () => {
    const out = formatCommitTitle('Update readme', { allowGitmoji: true, mode: 'gitmoji' });
    expect(out).toMatch(/chore: update readme$/);
  });

  it('fallbacks to emoji: subject when no type provided (pure mode)', () => {
    const out = formatCommitTitle('Something random', { allowGitmoji: true, mode: 'gitmoji-pure' });
    // Accept any emoji: subject lowercased
    expect(out.toLowerCase()).toMatch(/: something random$/);
  });
});
