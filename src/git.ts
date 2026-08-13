import { simpleGit } from 'simple-git';
import { execa } from 'execa';
import crypto from 'node:crypto';
import type { FileDiff } from './types.js';

const git = simpleGit();

export const ensureStagedChanges = async (): Promise<boolean> => {
  const status = await git.status();
  return status.staged.length > 0 || status.renamed.length > 0;
};

export const getStagedDiffRaw = async (): Promise<string> => {
  return git.diff(['--cached', '--unified=3', '--no-color', '-M']);
};

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export const parseDiffFromRaw = (raw: string): FileDiff[] => {
  if (!raw.trim()) return [];
  const lines = raw.split('\n');
  const files: FileDiff[] = [];
  let currentFile: FileDiff | null = null;
  for (const line of lines) {
    if (line.startsWith('diff --git a/')) {
      const pathMatch = line.match(/diff --git a\/(.+?) b\/(.+)$/);
      if (pathMatch) {
        const file = pathMatch[2];
        currentFile = { file, hunks: [], additions: 0, deletions: 0 } as FileDiff;
        files.push(currentFile);
      }
      continue;
    }
    if (line.startsWith('diff --git')) continue;
    if (line.startsWith('index ')) continue;
    if (line.startsWith('similarity index ')) continue;
    if (line.startsWith('rename from ')) continue;
    if (line.startsWith('rename to ')) continue;
    if (/^deleted file mode /.test(line)) {
      if (currentFile) currentFile.deleted = true;
      continue;
    }
    if (line.startsWith('--- ')) continue;
    if (line.startsWith('+++ ')) continue;

    if (line.startsWith('@@')) {
      if (!currentFile) continue;
      const m = line.match(HUNK_HEADER_RE);
      if (!m) continue;
      const from = parseInt(m[1], 10);
      const fromLen = parseInt(m[2] || '1', 10);
      const to = parseInt(m[3], 10);
      const toLen = parseInt(m[4] || '1', 10);
      const ctx = m[5]?.trim() || '';
      currentFile.hunks.push({
        file: currentFile.file,
        header: line,
        from,
        to,
        added: toLen,
        removed: fromLen,
        lines: [],
        hash: '',
        functionContext: ctx || undefined,
      });
      continue;
    }
    if (currentFile && currentFile.hunks.length) {
      const hunk = currentFile.hunks[currentFile.hunks.length - 1];
      hunk.lines.push(line);
      if (line.startsWith('+') && !line.startsWith('+++')) currentFile.additions++;
      if (line.startsWith('-') && !line.startsWith('---')) currentFile.deletions++;
    }
  }
  for (const f of files) {
    for (const h of f.hunks) {
      h.hash = crypto
        .createHash('sha1')
        .update(f.file + h.header + h.lines.join('\n'))
        .digest('hex')
        .slice(0, 8);
    }
  }
  return files;
};

export const parseDiff = async (): Promise<FileDiff[]> => {
  const raw = await getStagedDiffRaw();
  const parsed = parseDiffFromRaw(raw);
  if (parsed.length === 0) {
    const status = await git.status();
    const allStaged = [
      ...status.staged.map((f) => ({ file: f, hunks: [], additions: 0, deletions: 0 })),
      ...status.renamed.map((r) => ({ file: r.to, hunks: [], additions: 0, deletions: 0 })),
    ];
    if (allStaged.length > 0) {
      return allStaged;
    }
  }
  return parsed;
};

export const getStagedFilesAndDiff = async (): Promise<{
  files: FileDiff[];
  hasStagedChanges: boolean;
}> => {
  const [raw, status] = await Promise.all([getStagedDiffRaw(), git.status()]);
  const hasStagedChanges = status.staged.length > 0 || status.renamed.length > 0;
  const parsed = parseDiffFromRaw(raw);
  if (parsed.length === 0) {
    return {
      files: [
        ...status.staged.map((f) => ({ file: f, hunks: [], additions: 0, deletions: 0 })),
        ...status.renamed.map((r) => ({ file: r.to, hunks: [], additions: 0, deletions: 0 })),
      ],
      hasStagedChanges,
    };
  }
  return { files: parsed, hasStagedChanges };
};

export const getRecentCommitMessages = async (limit: number): Promise<string[]> => {
  const log = await git.log({ maxCount: limit });
  return log.all.map((e) => e.message);
};

// Commits run through execa rather than simple-git. simple-git's error-detection plugin
// collapses a failed command into `new GitError(undefined, stdout + stderr)` and discards
// the exit code, but the exit code is what separates a hook refusing the commit (git
// collapses any non-zero hook exit to 1) from git itself failing (128, always with a
// `fatal:` line). Losing that made a working guard read as a fault in this tool.
const GIT_FATAL_EXIT_CODE = 128;
const GIT_FATAL_LINE = /^fatal: /m;

export type CommitFailure = {
  output: string;
  exitCode: number;
  rejectedByHook: boolean;
};

export type CommitResult = { ok: true } | { ok: false; failure: CommitFailure };

const isHookRejection = (exitCode: number, output: string) =>
  exitCode !== GIT_FATAL_EXIT_CODE && !GIT_FATAL_LINE.test(output);

const runCommit = async (args: string[]): Promise<CommitResult> => {
  try {
    await execa('git', ['commit', ...args]);
    return { ok: true };
  } catch (e: any) {
    // No exit code means git never ran (missing binary, spawn failure) — a genuine fault,
    // so let it propagate rather than dressing it up as a rejected commit.
    if (typeof e?.exitCode !== 'number') throw e;
    // git forwards a hook's stdout onto its own stderr, so stderr carries the whole hook
    // report; stdout is appended only for the rare git message that lands there.
    const output = [e.stderr, e.stdout].filter(Boolean).join('\n').trimEnd();
    return {
      ok: false,
      failure: {
        output,
        exitCode: e.exitCode,
        rejectedByHook: isHookRejection(e.exitCode, output),
      },
    };
  }
};

export const createCommit = async (title: string, body?: string): Promise<CommitResult> =>
  runCommit(['-m', body ? [title, body].join('\n\n') : title]);

export const amendCommit = async (message: string): Promise<CommitResult> =>
  runCommit(['--amend', '-m', message]);

// Helpers for multi-commit split staging
export const resetIndex = async () => {
  await git.reset(['--mixed']);
};

export const stageFiles = async (files: string[]) => {
  if (!files.length) return;
  await git.add(files);
};

export const getStagedFiles = async (): Promise<string[]> => {
  const status = await git.status();
  return [...status.staged, ...status.renamed.map((r) => r.to)];
};
