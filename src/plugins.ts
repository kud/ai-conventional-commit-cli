import { AppConfig } from './config.js';
import { CommitCandidate, Plugin, PluginContext } from './types.js';
import { resolve } from 'node:path';

export async function loadPlugins(config: AppConfig, cwd = process.cwd()): Promise<Plugin[]> {
  const out: Plugin[] = [];
  for (const p of config.plugins || []) {
    try {
      const mod = await import(resolve(cwd, p));
      if (mod.default) out.push(mod.default as Plugin);
      else if (mod.plugin) out.push(mod.plugin as Plugin);
    } catch (e) {
      if (config.verbose) {
        console.error('[plugin]', p, 'failed to load', e);
      }
    }
  }
  return out;
}

export async function applyTransforms(
  candidates: CommitCandidate[],
  plugins: Plugin[],
  ctx: PluginContext
): Promise<CommitCandidate[]> {
  let current = candidates;
  for (const pl of plugins) {
    if (pl.transformCandidates) {
      current = await pl.transformCandidates(current, ctx);
    }
  }
  return current;
}

export async function runValidations(
  candidate: CommitCandidate,
  plugins: Plugin[],
  ctx: PluginContext
): Promise<string[]> {
  const errors: string[] = [];
  for (const pl of plugins) {
    if (pl.validateCandidate) {
      const res = await pl.validateCandidate(candidate, ctx);
      if (typeof res === 'string') errors.push(res);
      else if (Array.isArray(res)) errors.push(...res);
    }
  }
  return errors;
}