import { cosmiconfig } from 'cosmiconfig';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

export interface AppConfig {
  model: string;

  privacy: 'low' | 'medium' | 'high';
  style: 'standard' | 'gitmoji' | 'gitmoji-pure';
  styleSamples: number;
  maxTokens: number;
  cacheDir?: string;
  plugins?: string[];
  verbose?: boolean;
}

const DEFAULTS: AppConfig = {
  model: process.env.AICC_MODEL || 'github-copilot/gpt-4.1',

  privacy: (process.env.AICC_PRIVACY as any) || 'low',
  style: (process.env.AICC_STYLE as any) || 'standard',
  styleSamples: parseInt(process.env.AICC_STYLE_SAMPLES || '120', 10),
  maxTokens: parseInt(process.env.AICC_MAX_TOKENS || '512', 10),
  cacheDir: '.git/.aicc-cache',
  plugins: [],
  verbose: process.env.AICC_VERBOSE === 'true',
};

export function getGlobalConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return resolve(base, 'ai-conventional-commit-cli', 'aicc.json');
}

export function saveGlobalConfig(partial: Partial<AppConfig>): string {
  const filePath = getGlobalConfigPath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  let existing: any = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf8')) || {};
    } catch (e) {
      if (process.env.AICC_VERBOSE === 'true') {
        console.error('[ai-cc] Failed to parse existing global config, overwriting.');
      }
    }
  }
  const merged = { ...existing, ...partial };
  writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return filePath;
}

export interface AppConfigWithMeta extends AppConfig {
  _sources: Record<keyof AppConfig, 'default' | 'global' | 'project' | 'env' | 'override'>;
}

export async function loadConfig(cwd = process.cwd()): Promise<AppConfig> {
  return (await loadConfigDetailed(cwd)).config;
}

export async function loadConfigDetailed(cwd = process.cwd()): Promise<{
  config: AppConfigWithMeta;
  raw: { defaults: AppConfig; global: Partial<AppConfig>; project: any; env: Partial<AppConfig> };
}> {
  // Load global config first (lower precedence than project but above defaults)
  let globalCfg: Partial<AppConfig> = {};
  const globalPath = getGlobalConfigPath();
  if (existsSync(globalPath)) {
    try {
      globalCfg = JSON.parse(readFileSync(globalPath, 'utf8')) || {};
    } catch (e) {
      if (process.env.AICC_VERBOSE === 'true') {
        console.error('[ai-cc] Failed to parse global config, ignoring.');
      }
    }
  }

  const explorer = cosmiconfig('aicc');
  const result = await explorer.search(cwd);
  const projectCfg = (result?.config || {}) as Partial<AppConfig>;

  // Build env overrides explicitly (highest precedence before CLI runtime overrides)
  const envCfg: Partial<AppConfig> = {};
  if (process.env.AICC_MODEL) envCfg.model = process.env.AICC_MODEL;
  if (process.env.AICC_PRIVACY) envCfg.privacy = process.env.AICC_PRIVACY as any;
  if (process.env.AICC_STYLE) envCfg.style = process.env.AICC_STYLE as any;
  if (process.env.AICC_STYLE_SAMPLES)
    envCfg.styleSamples = parseInt(process.env.AICC_STYLE_SAMPLES, 10);
  if (process.env.AICC_MAX_TOKENS) envCfg.maxTokens = parseInt(process.env.AICC_MAX_TOKENS, 10);
  if (process.env.AICC_VERBOSE) envCfg.verbose = process.env.AICC_VERBOSE === 'true';

  const merged: AppConfig = {
    ...DEFAULTS,
    ...globalCfg,
    ...projectCfg,
    ...envCfg,
  } as AppConfig;

  merged.plugins = (merged.plugins || []).filter((p) => {
    const abs = resolve(cwd, p);
    return existsSync(abs);
  });

  const sources: AppConfigWithMeta['_sources'] = Object.keys(merged).reduce<any>((acc, key) => {
    const k = key as keyof AppConfig;
    let src: AppConfigWithMeta['_sources'][keyof AppConfig] = 'default';
    if (k in (globalCfg as any)) src = 'global';
    if (k in projectCfg) src = 'project';
    if (k in envCfg) src = 'env';
    acc[k] = src;
    return acc;
  }, {});

  const withMeta: AppConfigWithMeta = Object.assign(merged, { _sources: sources });

  return {
    config: withMeta,
    raw: { defaults: DEFAULTS, global: globalCfg, project: projectCfg, env: envCfg },
  };
}
