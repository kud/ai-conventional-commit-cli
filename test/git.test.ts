import { describe, it, expect } from 'vitest';
import { parseDiffFromRaw } from '../src/git.js';

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
