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

  it('keeps a leading ticket key instead of reading it as the type', () => {
    const out = formatCommitTitle('SHOP-1234: ✨ feat(cart): add saved baskets', {
      allowGitmoji: true,
      mode: 'gitmoji',
    });
    expect(out).toBe('SHOP-1234: ✨ feat(cart): add saved baskets');
  });

  it('keeps a multi-ticket key and still adds the glyph after it', () => {
    const out = formatCommitTitle('SHOP-1234 / SHOP-1240: feat(cart): centre the spinner', {
      allowGitmoji: true,
      mode: 'gitmoji',
    });
    expect(out).toBe('SHOP-1234 / SHOP-1240: ✨ feat(cart): centre the spinner');
  });

  it('restores the key case', () => {
    expect(
      formatCommitTitle('abc-1234: fix: handle empty list', {
        allowGitmoji: true,
        mode: 'gitmoji',
      }),
    ).toBe('ABC-1234: 🐛 fix: handle empty list');
  });

  it('keeps the prefix when gitmoji is disabled', () => {
    expect(
      formatCommitTitle('ABC-1234: feat: add thing', { allowGitmoji: false, mode: 'standard' }),
    ).toBe('ABC-1234: feat: add thing');
  });

  it('moves a leading gitmoji behind the ticket key', () => {
    expect(
      formatCommitTitle('✨ ABC-1234: feat: add thing', {
        allowGitmoji: true,
        mode: 'gitmoji',
      }),
    ).toBe('ABC-1234: ✨ feat: add thing');
  });

  it('moves a leading gitmoji with scope behind the ticket key', () => {
    expect(
      formatCommitTitle('🐛 ABC-1234: fix(api): handle empty list', {
        allowGitmoji: true,
        mode: 'gitmoji',
      }),
    ).toBe('ABC-1234: 🐛 fix(api): handle empty list');
  });

  it('drops a leading gitmoji behind the ticket key in standard mode', () => {
    expect(
      formatCommitTitle('✨ ABC-1234: feat: add thing', {
        allowGitmoji: false,
        mode: 'standard',
      }),
    ).toBe('ABC-1234: feat: add thing');
  });
});

// Issue #7: `♻️` is U+267B + U+FE0F. Treating it as one codepoint stranded the selector in
// front of the type, so the title fell through to the chore fallback.
describe('formatCommitTitle with multi-codepoint emoji', () => {
  const gitmoji = { allowGitmoji: true, mode: 'gitmoji' } as const;

  it('keeps a variation-selector emoji whole and adds no second type', () => {
    expect(
      formatCommitTitle('♻️ refactor(claude-code): use shui for hook adoption prompts', gitmoji),
    ).toBe('♻️ refactor(claude-code): use shui for hook adoption prompts');
  });

  it('adds a multi-codepoint emoji from the type map without splitting it', () => {
    expect(formatCommitTitle('perf(provider): trim startup', gitmoji)).toBe(
      '⚡️ perf(provider): trim startup',
    );
    expect(formatCommitTitle('⚡️ perf(provider): trim startup', gitmoji)).toBe(
      '⚡️ perf(provider): trim startup',
    );
  });

  it('keeps a ZWJ sequence as one emoji', () => {
    expect(formatCommitTitle('🧑‍💻 feat: add dev mode', gitmoji)).toBe('🧑‍💻 feat: add dev mode');
  });

  it('keeps the emoji whole in pure mode', () => {
    expect(
      formatCommitTitle('♻️ refactor: tidy', { allowGitmoji: true, mode: 'gitmoji-pure' }),
    ).toBe('♻️: tidy');
  });
});
