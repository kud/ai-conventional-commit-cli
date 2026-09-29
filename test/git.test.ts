import { describe, it, expect } from 'vitest';
import { parseDiffFromRaw, getBranchTicketPrefix } from '../src/git.js';
import { simpleGit } from 'simple-git';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Minimal synthetic diff with one new file (no prior index line needed)
const SAMPLE_DIFF = `diff --git a/src/example.ts b/src/example.ts
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/src/example.ts
@@ -0,0 +1,3 @@
+export function foo() {
+  return 42;
+}`;

// Diff for a renamed file with no content changes
const RENAMED_FILE_DIFF = `diff --git a/.github/workflows/auto-draft-pr.yml b/.github/workflows/pr-readiness-guard.yml
similarity index 100%
rename from .github/workflows/auto-draft-pr.yml
rename to .github/workflows/pr-readiness-guard.yml`;

describe('parseDiffFromRaw', () => {
  it('parses new file diff producing one file and one hunk', () => {
    const files = parseDiffFromRaw(SAMPLE_DIFF);
    expect(files.length).toBe(1);
    const f = files[0];
    expect(f.file).toBe('src/example.ts');
    expect(f.hunks.length).toBe(1);
    expect(f.additions).toBe(3);
    expect(f.deletions).toBe(0);
    const h = f.hunks[0];
    expect(h.lines.join('\n')).toContain('return 42;');
    expect(h.hash).toHaveLength(8);
  });

  it('parses renamed file with no content changes', () => {
    const files = parseDiffFromRaw(RENAMED_FILE_DIFF);
    expect(files.length).toBe(1);
    const f = files[0];
    expect(f.file).toBe('.github/workflows/pr-readiness-guard.yml');
    expect(f.hunks.length).toBe(0);
    expect(f.additions).toBe(0);
    expect(f.deletions).toBe(0);
  });
});

describe('getBranchTicketPrefix', () => {
  it('extracts ticket prefix from branch name', async () => {
    const testDir = join(tmpdir(), `aicc-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test.txt'), 'test');
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@test.com');
    await git.add('.');
    await git.commit('initial');

    // Create a branch with ticket prefix
    await git.checkoutLocalBranch('SHOP-1234/feature');

    // Change cwd to test dir and call the function
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const prefix = await getBranchTicketPrefix(testDir);
      expect(prefix).toBe('SHOP-1234');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('returns null for branch without ticket prefix', async () => {
    const testDir = join(tmpdir(), `aicc-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test.txt'), 'test');
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@test.com');
    await git.add('.');
    await git.commit('initial');

    // Stay on main branch
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const prefix = await getBranchTicketPrefix(testDir);
      expect(prefix).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('extracts ticket prefix from branch with multiple slashes', async () => {
    const testDir = join(tmpdir(), `aicc-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test.txt'), 'test');
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@test.com');
    await git.add('.');
    await git.commit('initial');

    await git.checkoutLocalBranch('ACC-4518/add-user-auth');

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const prefix = await getBranchTicketPrefix(testDir);
      expect(prefix).toBe('ACC-4518');
    } finally {
      process.chdir(originalCwd);
    }
  });
});
