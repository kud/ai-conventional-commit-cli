import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigDetailed, saveGlobalConfig, getGlobalConfigPath } from '../src/config.js';
import { existsSync, readFileSync } from 'node:fs';

const tmpDir = join(process.cwd(), 'tmp-config-precedence');

function resetGlobal() {
  const path = getGlobalConfigPath();
  try {
    if (existsSync(path)) rmSync(path);
  } catch {}
}

describe('config precedence', () => {
  beforeAll(() => {
    resetGlobal();
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  });
  afterAll(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    resetGlobal();
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
