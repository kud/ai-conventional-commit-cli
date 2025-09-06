import { describe, it, expect } from 'vitest';
import { extractJSON } from '../src/model/provider.js';

describe('extractJSON', () => {
  it('parses valid JSON', () => {
    const raw = `
Some preface
{
 "commits":[{"title":"feat: add feature","body":"details","score":90,"reasons":["clear"]}],
 "meta":{"splitRecommended":false}
}
Trailing text`;
    const plan = extractJSON(raw);
    expect(plan.commits[0].title).toBe('feat: add feature');
  });

  it('throws on invalid JSON', () => {
    const raw = `{ "commits": [ { "title": 5 } ] }`;
    expect(() => extractJSON(raw)).toThrow();
  });
});