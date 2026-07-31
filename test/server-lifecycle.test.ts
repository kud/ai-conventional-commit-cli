import { describe, it, expect } from 'vitest';
import { execSync, spawn } from 'node:child_process';

const findOpencodePids = (): number[] => {
  try {
    return execSync('pgrep -f "opencode serve"', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const hasOpencode = (): boolean => {
  try {
    execSync('command -v opencode', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

describe.skipIf(!hasOpencode())('opencode server lifecycle', () => {
  it('provider.close() kills the server and all its children', async () => {
    const { OpenCodeProvider } = await import('../src/model/provider.js');
    const provider = new OpenCodeProvider('github-copilot/claude-sonnet-4.6');
    provider.warmup();

    await new Promise((r) => setTimeout(r, 3000));

    const pidsBefore = findOpencodePids();
    expect(pidsBefore.length).toBeGreaterThan(0);

    await provider.close();
    await new Promise((r) => setTimeout(r, 500));

    for (const pid of pidsBefore) {
      expect(isProcessAlive(pid)).toBe(false);
    }
  }, 20_000);

  it('exit handler kills the server when parent exits without close()', async () => {
    const pidsBefore = findOpencodePids();

    const child = spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `
        import { OpenCodeProvider } from './src/model/provider.js';
        const p = new OpenCodeProvider();
        p.warmup();
        await new Promise(r => setTimeout(r, 3000));
        process.exit(0);
        `,
      ],
      { cwd: process.cwd(), env: { ...process.env, NODE_NO_WARNINGS: '1' } },
    );

    await new Promise<void>((resolve, reject) => {
      child.on('exit', () => resolve());
      child.on('error', reject);
      setTimeout(() => reject(new Error('child did not exit within 15s')), 15_000);
    });

    await new Promise((r) => setTimeout(r, 1000));

    const pidsAfter = findOpencodePids();
    const orphans = pidsAfter.filter((p) => !pidsBefore.includes(p));
    expect(orphans).toEqual([]);
  }, 25_000);
});
