import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigDetailed, saveGlobalConfig } from '../src/config.js';

const tmpDir = join(process.cwd(), 'tmp-config-precedence');
// Isolate the global config under a temp XDG_CONFIG_HOME so the test never
// reads or deletes the developer's real ~/.config/aicc/aicc.json.
const tmpConfigHome = join(tmpDir, 'xdg-config');
let originalXdg: string | undefined;
// AICC_MODEL is read as a config layer, so a developer machine that exports it
// would otherwise make the "nothing configured" case pass for the wrong reason.
const modelEnvVars = ['AICC_MODEL'] as const;
const originalModelEnv: Record<string, string | undefined> = {};

describe('config precedence', () => {
  beforeAll(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmpConfigHome;
    for (const name of modelEnvVars) {
      originalModelEnv[name] = process.env[name];
      delete process.env[name];
    }
    mkdirSync(tmpConfigHome, { recursive: true });
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  });
  afterAll(() => {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    for (const name of modelEnvVars) {
      const value = originalModelEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('leaves model unset when nothing configures it', async () => {
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.model).toBeUndefined();
  });

  it('defaults still apply to other keys', async () => {
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.privacy).toBe('low');
    expect(config._sources.privacy).toBe('default');
  });

  it('global overrides defaults', async () => {
    saveGlobalConfig({ model: 'global/model-x' });
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.model).toBe('global/model-x');
    expect(config._sources.model).toBe('global');
  });

  it('project overrides global', async () => {
    writeFileSync(join(tmpDir, '.aiccrc'), JSON.stringify({ model: 'project/model-y' }), 'utf8');
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.model).toBe('project/model-y');
    expect(config._sources.model).toBe('project');
  });

  it('env overrides project', async () => {
    process.env.AICC_MODEL = 'env/model-z';
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.model).toBe('env/model-z');
    expect(config._sources.model).toBe('env');
    delete process.env.AICC_MODEL;
  });
});
