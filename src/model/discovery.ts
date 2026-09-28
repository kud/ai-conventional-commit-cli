import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execa } from 'execa';
import Anthropic from '@anthropic-ai/sdk';

// Model ids may carry further slashes or version tags (openrouter/<vendor>/<model>,
// <provider>/<model>@<version>); only the first segment is the provider.
const MODEL_LINE_RE = /^[a-z0-9_.-]+\/\S+$/;

// `claude --help` documents these as the aliases for the latest models. There is no
// list subcommand, so this is the only inventory the Claude CLI offers.
export const CLAUDE_CLI_ALIASES = ['fable', 'opus', 'sonnet'] as const;

// These prefixes are routed to dedicated adapters by createProvider, never to
// OpenCode. An OpenCode model sharing one of them would be unusable as listed.
const NON_OPENCODE_PREFIXES = ['claude/', 'codex/', 'anthropic/'];

const ANTHROPIC_LIST_TIMEOUT_MS = 10_000;

export interface DiscoveryDeps {
  runOpencodeModels: () => Promise<string>;
  isOnPath: (bin: string) => boolean;
  listAnthropicModelIds: () => Promise<string[]>;
  env: NodeJS.ProcessEnv;
}

export type ProviderDiscovery =
  | { provider: string; status: 'listed'; models: string[] }
  | { provider: string; status: 'skipped'; reason: string };

export interface DiscoveryResult {
  models: string[];
  skipped: { provider: string; reason: string }[];
}

const isExecutable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const isOnPath = (bin: string): boolean =>
  (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => isExecutable(join(dir, bin)));

const listAnthropicModelIds = async (): Promise<string[]> => {
  const client = new Anthropic({ timeout: ANTHROPIC_LIST_TIMEOUT_MS });
  const ids: string[] = [];
  for await (const model of client.models.list()) ids.push(model.id);
  return ids;
};

export const defaultDiscoveryDeps: DiscoveryDeps = {
  runOpencodeModels: async () => (await execa('opencode', ['models'])).stdout,
  isOnPath,
  listAnthropicModelIds,
  env: process.env,
};

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const discoverOpencode = async (deps: DiscoveryDeps): Promise<ProviderDiscovery> => {
  if (!deps.isOnPath('opencode')) {
    return { provider: 'opencode', status: 'skipped', reason: 'opencode not found in PATH' };
  }
  try {
    const stdout = await deps.runOpencodeModels();
    const models = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => MODEL_LINE_RE.test(line))
      .filter((id) => !NON_OPENCODE_PREFIXES.some((prefix) => id.startsWith(prefix)));
    return { provider: 'opencode', status: 'listed', models };
  } catch (e) {
    return {
      provider: 'opencode',
      status: 'skipped',
      reason: `"opencode models" failed: ${errorMessage(e)}`,
    };
  }
};

const discoverClaudeCli = (deps: DiscoveryDeps): ProviderDiscovery => {
  if (!deps.isOnPath('claude')) {
    return { provider: 'claude', status: 'skipped', reason: 'claude CLI not found in PATH' };
  }
  return {
    provider: 'claude',
    status: 'listed',
    models: CLAUDE_CLI_ALIASES.map((alias) => `claude/${alias}`),
  };
};

const discoverAnthropic = async (deps: DiscoveryDeps): Promise<ProviderDiscovery> => {
  if (!deps.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', status: 'skipped', reason: 'ANTHROPIC_API_KEY not set' };
  }
  try {
    const ids = await deps.listAnthropicModelIds();
    return { provider: 'anthropic', status: 'listed', models: ids.map((id) => `anthropic/${id}`) };
  } catch (e) {
    return {
      provider: 'anthropic',
      status: 'skipped',
      reason: `listing failed: ${errorMessage(e)}`,
    };
  }
};

const discoverCodex = (): ProviderDiscovery => ({
  provider: 'codex',
  status: 'skipped',
  reason: 'model names are free text, not listable (use --model codex/<name>)',
});

export const discoverModels = async (
  deps: DiscoveryDeps = defaultDiscoveryDeps,
): Promise<DiscoveryResult> => {
  const results = await Promise.all([
    discoverOpencode(deps),
    discoverClaudeCli(deps),
    discoverAnthropic(deps),
    discoverCodex(),
  ]);

  const models = new Set<string>();
  const skipped: DiscoveryResult['skipped'] = [];
  for (const result of results) {
    if (result.status === 'listed') result.models.forEach((m) => models.add(m));
    else skipped.push({ provider: result.provider, reason: result.reason });
  }
  return { models: [...models], skipped };
};

export const formatSkipped = (skipped: DiscoveryResult['skipped']): string | undefined =>
  skipped.length === 0
    ? undefined
    : `Skipped providers: ${skipped.map((s) => `${s.provider} (${s.reason})`).join('; ')}`;
