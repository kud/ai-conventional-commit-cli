import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { truncateMiddle } from '../src/workflow/util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const collectPaths = (dir: string, base = dir): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const abs = join(dir, e.name);
    return e.isDirectory() ? collectPaths(abs, base) : [abs.slice(base.length + 1)];
  });
};

const FIXTURE_PATHS = collectPaths(join(__dirname, 'fixtures'));

describe('truncateMiddle', () => {
  describe('no truncation needed', () => {
    it('returns the string unchanged when exactly at max', () => {
      expect(truncateMiddle('src/index.ts', 12)).toBe('src/index.ts');
    });

    it('returns the string unchanged when shorter than max', () => {
      expect(truncateMiddle('short.ts', 50)).toBe('short.ts');
    });

    it('returns empty string unchanged', () => {
      expect(truncateMiddle('', 10)).toBe('');
    });
  });

  describe('truncation output length', () => {
    it('produces exactly max characters for even max', () => {
      const result = truncateMiddle('a'.repeat(100), 10);
      expect([...result].length).toBe(10);
    });

    it('produces exactly max characters for odd max', () => {
      const result = truncateMiddle('a'.repeat(100), 11);
      expect([...result].length).toBe(11);
    });

    it('places the ellipsis in the middle', () => {
      const result = truncateMiddle('a'.repeat(100), 9);
      expect(result[4]).toBe('…');
    });
  });

  describe('content preservation', () => {
    it('preserves the start of the string', () => {
      const result = truncateMiddle('profiles/work/ai/skills/SKILL.md', 20);
      expect(result.startsWith('profiles/')).toBe(true);
    });

    it('preserves the end of the string', () => {
      const result = truncateMiddle('profiles/work/ai/skills/SKILL.md', 20);
      expect(result.endsWith('SKILL.md')).toBe(true);
    });

    it('contains the ellipsis separator', () => {
      const result = truncateMiddle('profiles/work/ai/skills/SKILL.md', 20);
      expect(result.includes('…')).toBe(true);
    });

    it('tail gets one extra char when max is even (ceil bias)', () => {
      const result = truncateMiddle('abcdefghij', 5);
      // head = floor(4/2) = 2, tail = ceil(4/2) = 2 → "ab…ij"
      expect(result).toBe('ab…ij');
    });

    it('head and tail are equal when max is odd', () => {
      const result = truncateMiddle('abcdefghij', 6);
      // head = floor(5/2) = 2, tail = ceil(5/2) = 3 → "ab…hij"
      expect(result).toBe('ab…hij');
    });
  });

  describe('fixture paths', () => {
    const MAX = 50;

    it('fixture directory contains files', () => {
      expect(FIXTURE_PATHS.length).toBeGreaterThan(0);
    });

    it('every fixture path truncates to at most MAX characters', () => {
      for (const path of FIXTURE_PATHS) {
        const result = truncateMiddle(path, MAX);
        expect([...result].length).toBeLessThanOrEqual(MAX);
      }
    });

    it('short fixture paths are not truncated', () => {
      const short = FIXTURE_PATHS.filter((p) => p.length <= MAX);
      for (const path of short) {
        expect(truncateMiddle(path, MAX)).toBe(path);
      }
    });

    it('long fixture paths contain an ellipsis after truncation', () => {
      const long = FIXTURE_PATHS.filter((p) => p.length > MAX);
      for (const path of long) {
        expect(truncateMiddle(path, MAX)).toContain('…');
      }
    });

    it('long fixture paths preserve their filename after truncation', () => {
      const long = FIXTURE_PATHS.filter((p) => p.length > MAX);
      for (const path of long) {
        const filename = path.split('/').at(-1)!;
        const result = truncateMiddle(path, MAX);
        expect(result.endsWith(filename)).toBe(true);
      }
    });

    it('truncates the deeply nested skill path (standup-template.md)', () => {
      const path = 'profiles/work/ai/skills/w-meeting-log/references/standup-template.md';
      const result = truncateMiddle(path, MAX);
      expect([...result].length).toBe(MAX);
      expect(result.startsWith('profiles/')).toBe(true);
      expect(result.endsWith('standup-template.md')).toBe(true);
    });

    it('truncates the long config path (default-config.json)', () => {
      const path = 'profiles/home/config/apps/very-long-app-name/settings/default-config.json';
      const result = truncateMiddle(path, MAX);
      expect([...result].length).toBe(MAX);
      expect(result.endsWith('default-config.json')).toBe(true);
    });

    it('truncates the deep build output path (generated-file.js)', () => {
      const path = 'core/build/output/deeply/nested/folder/structure/generated-file.js';
      const result = truncateMiddle(path, MAX);
      expect([...result].length).toBe(MAX);
      expect(result.startsWith('core/')).toBe(true);
      expect(result.endsWith('generated-file.js')).toBe(true);
    });

    it('truncates the deep UI component path (Button.tsx)', () => {
      const path = 'packages/some-package/src/components/deeply/nested/ui/Button.tsx';
      const result = truncateMiddle(path, MAX);
      expect([...result].length).toBe(MAX);
      expect(result.endsWith('Button.tsx')).toBe(true);
    });

    it('truncates the alphabet-depth path (deep.ts)', () => {
      const path = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/deep.ts';
      const result = truncateMiddle(path, MAX);
      expect([...result].length).toBeLessThanOrEqual(MAX);
      expect(result.endsWith('deep.ts')).toBe(true);
    });

    it('does not truncate the smoke-test fixture (within limit)', () => {
      expect(truncateMiddle('smoke-test.md', MAX)).toBe('smoke-test.md');
    });
  });
});
