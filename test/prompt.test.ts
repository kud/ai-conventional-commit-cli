import { describe, it, expect } from 'vitest';
import { buildGenerationMessages } from '../src/prompt.js';

const baseFiles = [{ file: 'src/index.ts', hunks: [], additions: 10, deletions: 2 }];
const style = {
  tense: 'present',
  avgTitleLength: 42,
  usesScopes: true,
  gitmojiRatio: 0,
  topPrefixes: ['feat', 'fix'],
  conventionalRatio: 1,
};

function cfg(style: 'standard' | 'gitmoji' | 'gitmoji-pure') {
  return {
    model: 'x',
    privacy: 'low',
    style,
    styleSamples: 50,
    maxTokens: 512,
    plugins: [],
    verbose: false,
  } as any;
}

describe('prompt generation', () => {
  it('contains disallow emoji rule when gitmoji disabled', () => {
    const msgs = buildGenerationMessages({
      files: baseFiles as any,
      style: style as any,
      config: cfg('standard'),
      mode: 'single',
    });
    expect(msgs[0].content).toMatch(/Disallow all emojis/);
  });
  it('contains optional emoji rule when gitmoji enabled', () => {
    const msgs = buildGenerationMessages({
      files: baseFiles as any,
      style: style as any,
      config: cfg('gitmoji'),
      mode: 'single',
    });
    expect(msgs[0].content).toMatch(/OPTIONAL single leading gitmoji/);
  });
});
