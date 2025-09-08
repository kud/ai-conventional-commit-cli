import { cosmiconfig } from 'cosmiconfig';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export interface AppConfig {
  model: string;

  privacy: 'low' | 'medium' | 'high';
  gitmoji: boolean;
  gitmojiMode?: 'standard' | 'gitmoji' | 'gitmoji-pure';
  styleSamples: number;
  maxTokens: number;
  cacheDir?: string;
  plugins?: string[];
  verbose?: boolean;
}

const DEFAULTS: AppConfig = {
  model: process.env.AICC_MODEL || 'github-copilot/gpt-4.1',

  privacy: (process.env.AICC_PRIVACY as any) || 'low',
  gitmoji: process.env.AICC_GITMOJI === 'true',
  gitmojiMode: 'standard',
  styleSamples: parseInt(process.env.AICC_STYLE_SAMPLES || '120', 10),
  maxTokens: parseInt(process.env.AICC_MAX_TOKENS || '512', 10),
  cacheDir: '.git/.aicc-cache',
  plugins: [],
  verbose: process.env.AICC_VERBOSE === 'true',
};

export async function loadConfig(cwd = process.cwd()): Promise<AppConfig> {
  const explorer = cosmiconfig('aicc');
  const result = await explorer.search(cwd);
  const cfg: AppConfig = {
    ...DEFAULTS,
    ...(result?.config || {}),
  };
  cfg.plugins = (cfg.plugins || []).filter((p) => {
    const abs = resolve(cwd, p);
    return existsSync(abs);
  });
  return cfg;
}
