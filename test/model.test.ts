import { describe, it, expect } from 'vitest';
import { createProvider, CodexCliProvider, extractJSON, buildClaudeCliArgs, buildClaudeCliEnv } from '../src/model/provider.js';

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

  it('refuses to pick a model on the caller behalf', () => {
    expect(() => createProvider(undefined)).toThrow(/No model configured/);
    expect(() => createProvider('')).toThrow(/No model configured/);
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

describe('buildClaudeCliArgs', () => {
  const args = buildClaudeCliArgs('haiku');

  it('starts no MCP servers', () => {
    expect(args).toContain('--strict-mcp-config');
    expect(args).not.toContain('--mcp-config');
  });

  it('loads no settings, tools or skills', () => {
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).toContain('--disable-slash-commands');
  });

  it('replaces the default system prompt', () => {
    expect(args[args.indexOf('--system-prompt') + 1]).toMatch(/commit messages/);
  });

  it('passes the model through', () => {
    expect(args[args.indexOf('--model') + 1]).toBe('haiku');
  });
});

describe('buildClaudeCliEnv', () => {
  const env = buildClaudeCliEnv({ PATH: '/bin', MAX_THINKING_TOKENS: '8000' });

  it('turns thinking off, overriding the caller', () => {
    expect(env.MAX_THINKING_TOKENS).toBe('0');
  });

  it('skips non-essential traffic', () => {
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1');
  });

  it('keeps the rest of the environment', () => {
    expect(env.PATH).toBe('/bin');
  });
});
