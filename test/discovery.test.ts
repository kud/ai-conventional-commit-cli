import { describe, it, expect, vi } from 'vitest';
import { discoverModels, formatSkipped, type DiscoveryDeps } from '../src/model/discovery.js';

const makeDeps = (overrides: Partial<DiscoveryDeps> = {}): DiscoveryDeps => ({
  runOpencodeModels: vi.fn(async () => 'opencode/big-pickle\ngithub-copilot/gpt-5\n'),
  isOnPath: vi.fn(() => true),
  listAnthropicModelIds: vi.fn(async () => ['claude-sonnet-4-6']),
  env: { ANTHROPIC_API_KEY: 'test-key' },
  ...overrides,
});

describe('discoverModels', () => {
  it('aggregates every available provider as provider/model ids', async () => {
    const { models } = await discoverModels(makeDeps());
    expect(models).toEqual([
      'opencode/big-pickle',
      'github-copilot/gpt-5',
      'claude/fable',
      'claude/opus',
      'claude/sonnet',
      'anthropic/claude-sonnet-4-6',
    ]);
  });

  it('always reports codex as not listable', async () => {
    const { skipped } = await discoverModels(makeDeps());
    expect(skipped).toEqual([{ provider: 'codex', reason: expect.stringMatching(/free text/) }]);
  });

  it('skips anthropic without an API key and never calls the API', async () => {
    const deps = makeDeps({ env: {} });
    const { models, skipped } = await discoverModels(deps);
    expect(deps.listAnthropicModelIds).not.toHaveBeenCalled();
    expect(models.some((m) => m.startsWith('anthropic/'))).toBe(false);
    expect(skipped).toContainEqual({ provider: 'anthropic', reason: 'ANTHROPIC_API_KEY not set' });
  });

  it('skips binaries missing from PATH without spawning them', async () => {
    const deps = makeDeps({ isOnPath: vi.fn(() => false) });
    const { models, skipped } = await discoverModels(deps);
    expect(deps.runOpencodeModels).not.toHaveBeenCalled();
    expect(models).toEqual(['anthropic/claude-sonnet-4-6']);
    expect(skipped.map((s) => s.provider)).toEqual(['opencode', 'claude', 'codex']);
  });

  it('turns a provider failure into a skip rather than failing the whole listing', async () => {
    const deps = makeDeps({
      runOpencodeModels: vi.fn(async () => {
        throw new Error('boom');
      }),
      listAnthropicModelIds: vi.fn(async () => {
        throw new Error('401');
      }),
    });
    const { models, skipped } = await discoverModels(deps);
    expect(models).toEqual(['claude/fable', 'claude/opus', 'claude/sonnet']);
    expect(skipped.find((s) => s.provider === 'opencode')?.reason).toMatch(/boom/);
    expect(skipped.find((s) => s.provider === 'anthropic')?.reason).toMatch(/401/);
  });

  it('drops opencode ids whose prefix is routed to another adapter, and noise lines', async () => {
    const deps = makeDeps({
      runOpencodeModels: vi.fn(
        async () =>
          'openrouter/anthropic/claude-3.5-haiku\ngoogle-vertex-anthropic/claude-opus-4-6@default\nanthropic/claude-opus-4-7\nclaude/sonnet\ncodex/gpt-5.5\nsome banner text\nopenrouter/x-ai:grok\n',
      ),
      env: {},
    });
    const { models } = await discoverModels(deps);
    expect(models).toEqual([
      'openrouter/anthropic/claude-3.5-haiku',
      'google-vertex-anthropic/claude-opus-4-6@default',
      'openrouter/x-ai:grok',
      'claude/fable',
      'claude/opus',
      'claude/sonnet',
    ]);
  });
});

describe('formatSkipped', () => {
  it('is undefined when nothing was skipped', () => {
    expect(formatSkipped([])).toBeUndefined();
  });

  it('names each skipped provider and why, on one line', () => {
    const line = formatSkipped([
      { provider: 'anthropic', reason: 'ANTHROPIC_API_KEY not set' },
      { provider: 'codex', reason: 'not listable' },
    ]);
    expect(line).toBe(
      'Skipped providers: anthropic (ANTHROPIC_API_KEY not set); codex (not listable)',
    );
    expect(line).not.toContain('\n');
  });
});
