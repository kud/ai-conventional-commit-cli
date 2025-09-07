import { simpleGit } from 'simple-git';
import crypto from 'node:crypto';
import { FileDiff } from './types.js';

const git = simpleGit();

export const ensureStagedChanges = async (): Promise<boolean> => {
  const status = await git.status();
  return status.staged.length > 0;
};

export const getStagedDiffRaw = async (): Promise<string> => {
  return git.diff(['--cached', '--unified=3', '--no-color']);
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
  return parseDiffFromRaw(raw);
};

export const getRecentCommitMessages = async (limit: number): Promise<string[]> => {
  const log = await git.log({ maxCount: limit });
  return log.all.map((e) => e.message);
};

export const createCommit = async (title: string, body?: string) => {
  if (body) {
    await git.commit([title, body].join('\n\n'));
  } else {
    await git.commit(title);
  }
};

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
  return status.staged;
};
