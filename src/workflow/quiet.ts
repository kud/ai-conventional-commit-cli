import { execa } from 'execa';

export interface CommitSummary {
  sha: string;
  subject: string;
  files: number;
  insertions: number;
  deletions: number;
}

// Explicit flags win (--verbose over --quiet), then config/env, and with nothing set a
// run whose stdout is not a terminal is quiet: scripts read one line, people see the panel.
export const resolveQuiet = (opts: {
  quietFlag?: boolean;
  verboseFlag?: boolean;
  configured?: boolean;
  isTTY?: boolean;
}): boolean => {
  if (opts.verboseFlag) return false;
  if (opts.quietFlag) return true;
  if (typeof opts.configured === 'boolean') return opts.configured;
  return !opts.isTTY;
};

export const formatQuietLine = (s: CommitSummary): string =>
  `✓ ${s.sha} ${s.subject} · ${s.files} ${s.files === 1 ? 'file' : 'files'} +${s.insertions} −${s.deletions}`;

// Read back what git actually recorded, so a hook that rewrites the message or the
// staged content is reflected in the line.
export const readHeadSummary = async (cwd?: string): Promise<CommitSummary> => {
  const { stdout } = await execa(
    'git',
    ['show', '--numstat', '--no-renames', '--format=%h%x00%s', 'HEAD'],
    { cwd },
  );
  const [header, ...rest] = stdout.split('\n');
  const [sha, subject = ''] = header.split('\0');
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of rest) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (!m) continue;
    files++;
    if (m[1] !== '-') insertions += parseInt(m[1], 10);
    if (m[2] !== '-') deletions += parseInt(m[2], 10);
  }
  return { sha, subject, files, insertions, deletions };
};
