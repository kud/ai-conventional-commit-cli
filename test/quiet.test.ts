import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execa } from 'execa';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatQuietLine, readHeadSummary, resolveQuiet } from '../src/workflow/quiet.js';
import { createQuietSteps } from '../src/workflow/ui.js';
import { parseBooleanEnv } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLI = join(ROOT, 'src', 'index.ts');
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const QUIET_LINE = /^✓ [0-9a-f]{7,} \S.* · \d+ files? \+\d+ −\d+$/;

let repo: string;

const git = (...args: string[]) => execa('git', args, { cwd: repo });

const write = (name: string, contents: string) => writeFileSync(join(repo, name), contents);

// execa never gives the child a terminal, so these runs behave like a script calling the CLI.
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  execa(process.execPath, [TSX, CLI, ...args], {
    cwd: repo,
    reject: false,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(repo, '.xdg-config'),
      XDG_CACHE_HOME: join(repo, '.xdg-cache'),
      AICC_DEBUG_PROVIDER: 'mock',
      AICC_MODEL: 'claude/haiku',
      AICC_STYLE: 'standard',
      AICC_QUIET: undefined,
      AICC_YES: undefined,
      ...env,
    },
  });

beforeEach(async () => {
  repo = mkdtempSync(join(tmpdir(), 'aicc-quiet-'));
  await git('init', '-q', '.');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test');
  await git('config', 'core.hooksPath', '.git/hooks');
  await git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(repo, '.git', 'info', 'exclude'), '.xdg-*\n');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('formatQuietLine', () => {
  it('uses the singular for one file', () => {
    expect(
      formatQuietLine({
        sha: 'abc1234',
        subject: 'feat: add a',
        files: 1,
        insertions: 3,
        deletions: 0,
      }),
    ).toBe('✓ abc1234 feat: add a · 1 file +3 −0');
  });

  it('uses the plural for several files', () => {
    expect(
      formatQuietLine({
        sha: 'abc1234',
        subject: 'fix(api): handle empty page',
        files: 4,
        insertions: 40,
        deletions: 12,
      }),
    ).toBe('✓ abc1234 fix(api): handle empty page · 4 files +40 −12');
  });
});

describe('resolveQuiet', () => {
  it('is quiet by default when stdout is not a terminal', () => {
    expect(resolveQuiet({ isTTY: false })).toBe(true);
    expect(resolveQuiet({ isTTY: undefined })).toBe(true);
  });

  it('shows the full output by default in a terminal', () => {
    expect(resolveQuiet({ isTTY: true })).toBe(false);
  });

  it('lets --quiet win in a terminal', () => {
    expect(resolveQuiet({ quietFlag: true, isTTY: true })).toBe(true);
  });

  it('lets --verbose override both the non-terminal default and a configured quiet', () => {
    expect(resolveQuiet({ verboseFlag: true, isTTY: false })).toBe(false);
    expect(resolveQuiet({ verboseFlag: true, configured: true, isTTY: false })).toBe(false);
    expect(resolveQuiet({ verboseFlag: true, quietFlag: true, isTTY: false })).toBe(false);
  });

  it('follows the configured value when no flag is given', () => {
    expect(resolveQuiet({ configured: false, isTTY: false })).toBe(false);
    expect(resolveQuiet({ configured: true, isTTY: true })).toBe(true);
  });
});

describe('parseBooleanEnv', () => {
  it('reads 1/true as on and 0/false as off', () => {
    expect(parseBooleanEnv('1')).toBe(true);
    expect(parseBooleanEnv('true')).toBe(true);
    expect(parseBooleanEnv('0')).toBe(false);
    expect(parseBooleanEnv('false')).toBe(false);
  });

  it('leaves unset or unrecognised values unset', () => {
    expect(parseBooleanEnv(undefined)).toBeUndefined();
    expect(parseBooleanEnv('')).toBeUndefined();
    expect(parseBooleanEnv('maybe')).toBeUndefined();
  });
});

describe('readHeadSummary', () => {
  it('counts a single-file commit', async () => {
    write('a.txt', 'one\ntwo\n');
    await git('add', '.');
    await git('commit', '-q', '-m', 'feat: add a');
    const summary = await readHeadSummary(repo);
    expect(summary).toMatchObject({
      subject: 'feat: add a',
      files: 1,
      insertions: 2,
      deletions: 0,
    });
    expect(summary.sha).toMatch(/^[0-9a-f]{7,}$/);
  });

  it('totals insertions and deletions across several files', async () => {
    write('a.txt', 'one\ntwo\n');
    write('b.txt', 'keep\ndrop\n');
    await git('add', '.');
    await git('commit', '-q', '-m', 'chore: seed');
    write('a.txt', 'one\ntwo\nthree\n');
    write('b.txt', 'keep\n');
    write('c.txt', 'new\n');
    await git('add', '.');
    await git('commit', '-q', '-m', 'refactor: reshape');
    expect(await readHeadSummary(repo)).toMatchObject({
      subject: 'refactor: reshape',
      files: 3,
      insertions: 2,
      deletions: 1,
    });
  });
});

describe('createQuietSteps', () => {
  it('names the failing step on stderr and rethrows', async () => {
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
      });
    try {
      const steps = createQuietSteps();
      await expect(
        steps.step('Calling model', async () => {
          throw new Error('model unreachable');
        }),
      ).rejects.toThrow('model unreachable');
    } finally {
      spy.mockRestore();
    }
    expect(writes.join('')).toContain('Calling model failed: model unreachable');
  });
});

describe('generate output mode (CLI)', () => {
  it('prints exactly one line on stdout when not run in a terminal', async () => {
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout, stderr, exitCode } = await run(['generate', '--yes']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    const lines = stdout.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(QUIET_LINE);
    expect(lines[0]).toContain(' chore: mock commit from provider · 1 file +1 −0');
  });

  it('pluralises when several files are committed', async () => {
    write('a.txt', 'one\n');
    write('b.txt', 'two\nthree\n');
    await git('add', '.');
    const { stdout } = await run(['generate', '--yes']);
    expect(stdout.trim()).toMatch(/ · 2 files \+3 −0$/);
  });

  it('is quiet on the root command too', async () => {
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout } = await run(['--yes']);
    expect(stdout.trim()).toMatch(QUIET_LINE);
  });

  it('brings the full output back with --verbose', async () => {
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout, exitCode } = await run(['generate', '--yes', '--verbose']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Suggested commit');
    expect(stdout).toContain('commit created');
    expect(stdout).not.toMatch(/^✓ /m);
  });

  it('brings the full output back with AICC_QUIET=0', async () => {
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout } = await run(['generate', '--yes'], { AICC_QUIET: '0' });
    expect(stdout).toContain('Suggested commit');
  });

  it('still prints a refused commit in full, on stderr', async () => {
    const hook = join(repo, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho "guard: looks like a secret" >&2\nexit 1\n');
    chmodSync(hook, 0o755);
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout, stderr, exitCode } = await run(['generate', '--yes']);
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('guard: looks like a secret');
    expect(stderr).toContain('A git hook refused the commit');
  });

  it('still prints a configuration error, on stderr', async () => {
    write('a.txt', 'one\n');
    await git('add', '.');
    const { stdout, stderr, exitCode } = await run(['generate', '--yes'], {
      AICC_MODEL: undefined,
    });
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('No model configured');
  });
});
