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

  describe('ticket-prefixed titles', () => {
    const gitmoji = { allowGitmoji: true, mode: 'gitmoji' as const };

    it('keeps an already-formatted prefixed title intact instead of wrapping it in chore', () => {
      expect(formatCommitTitle('ABC-1234: ✨ feat(launcher): add preview panel', gitmoji)).toBe(
        'ABC-1234: ✨ feat(launcher): add preview panel',
      );
    });

    it('adds the gitmoji after the ticket key', () => {
      expect(formatCommitTitle('ABC-1234: feat(launcher): add preview panel', gitmoji)).toBe(
        'ABC-1234: ✨ feat(launcher): add preview panel',
      );
    });

    it('restores the key case', () => {
      expect(formatCommitTitle('abc-1234: fix: handle empty list', gitmoji)).toBe(
        'ABC-1234: 🐛 fix: handle empty list',
      );
    });

    it('keeps the prefix when gitmoji is disabled', () => {
      expect(
        formatCommitTitle('ABC-1234: feat: add thing', { allowGitmoji: false, mode: 'standard' }),
      ).toBe('ABC-1234: feat: add thing');
    });
  });
});
