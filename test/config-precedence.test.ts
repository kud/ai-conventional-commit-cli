import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigDetailed, saveGlobalConfig } from '../src/config.js';

const tmpDir = join(process.cwd(), 'tmp-config-precedence');
// Isolate the global config under a temp XDG_CONFIG_HOME so the test never
// reads or deletes the developer's real ~/.config/aicc/aicc.json.
const tmpConfigHome = join(tmpDir, 'xdg-config');
let originalXdg: string | undefined;

describe('config precedence', () => {
  beforeAll(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmpConfigHome;
    mkdirSync(tmpConfigHome, { recursive: true });
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  });
  afterAll(() => {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('defaults apply when nothing else set', async () => {
    const { config } = await loadConfigDetailed(tmpDir);
    expect(config.model).toBeDefined();
    expect(config._sources.model).toBe('default');
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
