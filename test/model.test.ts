import { describe, it, expect } from 'vitest';
import { createProvider, CodexCliProvider, extractJSON } from '../src/model/provider.js';

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

describe('createProvider', () => {
  it('routes codex/ models to the Codex CLI provider', () => {
    const provider = createProvider('codex/gpt-5.5');
    expect(provider).toBeInstanceOf(CodexCliProvider);
    expect(provider.name()).toBe('codex-cli');
  });
});

describe('CodexCliProvider', () => {
  it('returns a parseable commit plan in mock mode without spawning codex', async () => {
    const previous = process.env.AICC_DEBUG_PROVIDER;
    process.env.AICC_DEBUG_PROVIDER = 'mock';
    try {
      const raw = await new CodexCliProvider('codex/gpt-5.5').chat([
        { role: 'user', content: 'diff' },
      ]);
      const plan = extractJSON(raw);
      expect(plan.commits.length).toBeGreaterThan(0);
    } finally {
      process.env.AICC_DEBUG_PROVIDER = previous;
    }
  });
});
