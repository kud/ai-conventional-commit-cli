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