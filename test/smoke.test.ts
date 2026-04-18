import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'src', 'index.ts');

const run = (...args: string[]) => execa('npx', ['tsx', CLI, ...args], { reject: false });

describe('CLI smoke tests', () => {
  describe('--version', () => {
    it('exits 0', async () => {
      const { exitCode } = await run('--version');
      expect(exitCode).toBe(0);
    });

    it('prints a semver string', async () => {
      const { stdout } = await run('--version');
      expect(stdout).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('-V shorthand', () => {
    it('prints the same version as --version', async () => {
      const [a, b] = await Promise.all([run('--version'), run('-V')]);
      expect(a.stdout.trim()).toBe(b.stdout.trim());
    });
  });

  describe('config show --json', () => {
    it('exits 0', async () => {
      const { exitCode } = await run('config', 'show', '--json');
      expect(exitCode).toBe(0);
    });

    it('produces valid JSON', async () => {
      const { stdout } = await run('config', 'show', '--json');
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it('JSON contains a config key', async () => {
      const { stdout } = await run('config', 'show', '--json');
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty('config');
    });

    it('config object has a model field', async () => {
      const { stdout } = await run('config', 'show', '--json');
      const { config } = JSON.parse(stdout);
      expect(config).toHaveProperty('model');
    });

    it('config object has a style field', async () => {
      const { stdout } = await run('config', 'show', '--json');
      const { config } = JSON.parse(stdout);
      expect(config).toHaveProperty('style');
    });

    it('_sources tracks the origin of each key', async () => {
      const { stdout } = await run('config', 'show', '--json');
      const { config } = JSON.parse(stdout);
      expect(config).toHaveProperty('_sources');
    });
  });

  describe('config get', () => {
    it('exits 0 for a valid key', async () => {
      const { exitCode } = await run('config', 'get', 'model');
      expect(exitCode).toBe(0);
    });

    it('prints a non-empty value for model', async () => {
      const { stdout } = await run('config', 'get', 'model');
      expect(stdout.trim().length).toBeGreaterThan(0);
    });

    it('prints a non-empty value for style', async () => {
      const { stdout } = await run('config', 'get', 'style');
      expect(stdout.trim().length).toBeGreaterThan(0);
    });

    it('exits non-zero for an unknown key', async () => {
      const { exitCode } = await run('config', 'get', 'nonexistent-key');
      expect(exitCode).not.toBe(0);
    });

    it('writes an error message for an unknown key', async () => {
      const { stderr } = await run('config', 'get', 'nonexistent-key');
      expect(stderr).toContain('Unknown config key');
    });

    it('includes source label with --with-source', async () => {
      const { stdout } = await run('config', 'get', 'model', '--with-source');
      expect(stdout).toMatch(/\(\w/);
    });
  });

  describe('unknown command', () => {
    it('exits non-zero', async () => {
      const { exitCode } = await run('this-command-does-not-exist');
      expect(exitCode).not.toBe(0);
    });
  });
});
