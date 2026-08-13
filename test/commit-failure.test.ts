import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCommit, amendCommit } from '../src/git.js';

const HOOK_REJECTION_EXIT_CODE = 1;
const GIT_FATAL_EXIT_CODE = 128;

let repo: string;
let originalCwd: string;

const git = (...args: string[]) => execa('git', args, { cwd: repo });

const installPreCommitHook = (script: string) => {
  const hook = join(repo, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, `#!/bin/sh\n${script}\n`);
  chmodSync(hook, 0o755);
};

const stageAFile = async (name: string) => {
  writeFileSync(join(repo, name), `contents of ${name}\n`);
  await git('add', name);
};

beforeEach(async () => {
  originalCwd = process.cwd();
  repo = mkdtempSync(join(tmpdir(), 'aicc-commit-'));
  await git('init', '-q', '.');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test');
  // A developer machine may point core.hooksPath at a global hooks directory — the very
  // setup that surfaced this bug — which would otherwise run their hooks against this repo.
  await git('config', 'core.hooksPath', '.git/hooks');
  await git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
  process.chdir(repo);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(repo, { recursive: true, force: true });
});

describe('createCommit', () => {
  it('reports success when nothing blocks the commit', async () => {
    await stageAFile('a.txt');
    const result = await createCommit('feat: add a');
    expect(result.ok).toBe(true);
  });

  it('records the commit message including the body', async () => {
    await stageAFile('a.txt');
    await createCommit('feat: add a', 'Some explanation.');
    const { stdout } = await git('log', '-1', '--format=%B');
    expect(stdout.trim()).toBe('feat: add a\n\nSome explanation.');
  });

  it('treats a hook refusing the commit as a rejection, not a fault', async () => {
    installPreCommitHook('echo "guard: looks like a secret" >&2\nexit 1');
    await stageAFile('a.txt');
    const result = await createCommit('feat: add a');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.rejectedByHook).toBe(true);
    expect(result.failure.exitCode).toBe(HOOK_REJECTION_EXIT_CODE);
  });

  it('passes the hook report through verbatim', async () => {
    installPreCommitHook('echo "guard: looks like a secret" >&2\nexit 1');
    await stageAFile('a.txt');
    const result = await createCommit('feat: add a');
    if (result.ok) throw new Error('expected the hook to refuse the commit');
    expect(result.failure.output).toContain('guard: looks like a secret');
  });

  it('captures hook output written to stdout as well as stderr', async () => {
    installPreCommitHook('echo "printed to stdout"\necho "printed to stderr" >&2\nexit 1');
    await stageAFile('a.txt');
    const result = await createCommit('feat: add a');
    if (result.ok) throw new Error('expected the hook to refuse the commit');
    expect(result.failure.output).toContain('printed to stdout');
    expect(result.failure.output).toContain('printed to stderr');
  });

  it('leaves the branch untouched when a hook refuses', async () => {
    installPreCommitHook('exit 1');
    await stageAFile('a.txt');
    await createCommit('feat: add a');
    const { stdout } = await git('log', '--oneline', '--all');
    expect(stdout.trim()).toBe('');
  });

  it('still reads as a rejection when the hook exits with an unusual code', async () => {
    installPreCommitHook('echo "refused" >&2\nexit 3');
    await stageAFile('a.txt');
    const result = await createCommit('feat: add a');
    if (result.ok) throw new Error('expected the hook to refuse the commit');
    // git collapses any non-zero hook exit to 1 rather than passing the hook's own code on.
    expect(result.failure.exitCode).toBe(HOOK_REJECTION_EXIT_CODE);
    expect(result.failure.rejectedByHook).toBe(true);
  });

  it('does not mistake a genuine git failure for a hook rejection', async () => {
    await stageAFile('a.txt');
    writeFileSync(join(repo, '.git', 'index.lock'), '');
    const result = await createCommit('feat: add a');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.rejectedByHook).toBe(false);
    expect(result.failure.exitCode).toBe(GIT_FATAL_EXIT_CODE);
    expect(result.failure.output).toContain('fatal:');
  });
});

describe('amendCommit', () => {
  it('rewrites the message of the previous commit', async () => {
    await stageAFile('a.txt');
    await createCommit('feat: original');
    const result = await amendCommit('feat: reworded');
    expect(result.ok).toBe(true);
    const { stdout } = await git('log', '-1', '--format=%s');
    expect(stdout.trim()).toBe('feat: reworded');
  });

  it('treats a hook refusing an amend as a rejection, not a fault', async () => {
    await stageAFile('a.txt');
    await createCommit('feat: original');
    installPreCommitHook('echo "guard: no amending" >&2\nexit 1');
    const result = await amendCommit('feat: reworded');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.rejectedByHook).toBe(true);
    expect(result.failure.output).toContain('guard: no amending');
  });

  it('leaves the original message in place when a hook refuses', async () => {
    await stageAFile('a.txt');
    await createCommit('feat: original');
    installPreCommitHook('exit 1');
    await amendCommit('feat: reworded');
    const { stdout } = await git('log', '-1', '--format=%s');
    expect(stdout.trim()).toBe('feat: original');
  });
});
