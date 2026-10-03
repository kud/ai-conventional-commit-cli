import { describe, it, expect } from 'vitest';
import { buildStyleProfile } from '../src/style.js';

describe('style profile', () => {
  it('handles empty', () => {
    const profile = buildStyleProfile([]);
    expect(profile.avgTitleLength).toBe(50);
  });
  it('analyzes sample', () => {
    const profile = buildStyleProfile([
      'feat(api): add endpoint',
      'fix: bug',
      'docs: update readme'
    ]);
    expect(profile.topPrefixes.length).toBeGreaterThan(0);
  });
});
describe('style profile with gitmoji and ticket prefixes', () => {
  const profile = buildStyleProfile([
    '✨ feat(auth): add login',
    '♻️ refactor(api): split handler',
    'SHOP-12: 🐛 fix(cart): clear on logout',
    '📝 docs(readme): add usage',
  ]);

  it('reads the type behind a leading gitmoji or ticket key', () => {
    expect(profile.conventionalRatio).toBe(1);
    expect(profile.topPrefixes).toEqual(expect.arrayContaining(['feat', 'refactor', 'fix', 'docs']));
  });

  it('sees the scopes', () => {
    expect(profile.usesScopes).toBe(true);
  });

  it('counts gitmoji outside the U+1F300 block, such as ✨ and ♻️', () => {
    expect(profile.gitmojiRatio).toBe(1);
  });
});
