import { sanitizeTitle, normalizeConventionalTitle } from './guardrails.js';

export interface GitmojiFormatOptions {
  allowGitmoji: boolean;
  mode?: 'standard' | 'gitmoji' | 'gitmoji-pure';
}

const EMOJI_MAP: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  chore: '🧹',
  docs: '📝',
  refactor: '♻️',
  test: '✅',
  ci: '🤖',
  perf: '⚡️',
  style: '🎨',
  build: '🏗️',
  revert: '⏪',
  merge: '🔀',
  security: '🔒',
  release: '🏷️',
};

const EMOJI_TYPE_RE = /^([\p{Emoji}\p{So}\p{Sk}])\s+(\w+)(\(.+\))?:\s+(.*)$/u; // emoji + type
const TYPE_RE = /^(\w+)(\(.+\))?:\s+(.*)$/; // type only

export const formatCommitTitle = (raw: string, opts: GitmojiFormatOptions): string => {
  const { allowGitmoji, mode = 'standard' } = opts;
  let norm = normalizeConventionalTitle(sanitizeTitle(raw, allowGitmoji));

  if (!allowGitmoji || (mode !== 'gitmoji' && mode !== 'gitmoji-pure')) {
    return norm;
  }

  if (mode === 'gitmoji-pure') {
    let m = norm.match(EMOJI_TYPE_RE);
    if (m) {
      const emoji = m[1];
      const subject = m[4];
      norm = `${emoji}: ${subject}`;
    } else if ((m = norm.match(TYPE_RE) as RegExpMatchArray | null)) {
      const type = m[1];
      const subject = m[3];
      const em = EMOJI_MAP[type as keyof typeof EMOJI_MAP] || '🔧';
      norm = `${em}: ${subject}`;
    } else if (!/^([\p{Emoji}\p{So}\p{Sk}])+:/u.test(norm)) {
      norm = `🔧: ${norm}`;
    }
    return norm;
  }

  // gitmoji mode
  let m = norm.match(EMOJI_TYPE_RE);
  if (m) {
    return norm;
  }
  if ((m = norm.match(TYPE_RE) as RegExpMatchArray | null)) {
    const type = m[1];
    const scope = m[2] || '';
    const subject = m[3];
    const em = EMOJI_MAP[type as keyof typeof EMOJI_MAP] || '🔧';
    norm = `${em} ${type}${scope}: ${subject}`;
  } else if (!/^([\p{Emoji}\p{So}\p{Sk}])+\s+\w+.*:/u.test(norm)) {
    norm = `🔧 chore: ${norm}`;
  }
  return norm;
};

export const batchFormatTitles = (titles: string[], opts: GitmojiFormatOptions): string[] =>
  titles.map((t) => formatCommitTitle(t, opts));
