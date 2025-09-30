import { CommitCandidate } from './types.js';

const SECRET_PATTERNS = [
  /AWS_[A-Z0-9_]+/i,
  /BEGIN RSA PRIVATE KEY/,
  /-----BEGIN PRIVATE KEY-----/,
  /ssh-rsa AAAA/,
];

const CONVENTIONAL_RE =
  /^(?:([\p{Emoji}\p{So}\p{Sk}]+)\s+(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert|merge|security|release)(\(.+\))?:\s|([\p{Emoji}\p{So}\p{Sk}]+):\s.*|([\p{Emoji}\p{So}\p{Sk}]+):\s*$|(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert|merge|security|release)(\(.+\))?:\s)/u;

export const sanitizeTitle = (title: string, allowEmoji: boolean): string => {
  let t = title.trim();
  if (allowEmoji) {
    // If multiple leading emoji/punctuation tokens, collapse to a single emoji then a space
    const multi = t.match(/^((?:[\p{Emoji}\p{So}\p{Sk}]+)[\p{Emoji}\p{So}\p{Sk}\s]*)+/u);
    if (multi) {
      // Keep only the first visible symbol
      const first = Array.from(multi[0].trim())[0];
      t = first + ' ' + t.slice(multi[0].length).trimStart();
    }
  } else {
    // Strip all leading emoji/symbol/punctuation clusters entirely
    t = t.replace(/^([\p{Emoji}\p{So}\p{Sk}\p{P}]+\s*)+/u, '').trimStart();
  }
  return t;
};

export const normalizeConventionalTitle = (title: string): string => {
  let original = title.trim();
  // Capture first emoji (if any) to optionally preserve
  let leadingEmoji = '';
  const emojiCluster = original.match(/^[\p{Emoji}\p{So}\p{Sk}]+/u);
  if (emojiCluster) {
    leadingEmoji = Array.from(emojiCluster[0])[0]; // first glyph only
  }
  // Remove all leading emoji/symbol/punctuation clusters for normalization
  let t = original.replace(/^([\p{Emoji}\p{So}\p{Sk}\p{P}]+\s*)+/u, '').trim();

  const m = t.match(/^(\w+)(\(.+\))?:\s+(.*)$/);
  let result: string;
  if (m) {
    const type = m[1].toLowerCase();
    const scope = m[2] || '';
    let subject = m[3].trim();
    subject = subject.replace(/\.$/, '');
    subject = subject.charAt(0).toLowerCase() + subject.slice(1);
    result = `${type}${scope}: ${subject}`;
  } else if (!/^\w+\(.+\)?: /.test(t)) {
    // Fallback to chore
    t = t.replace(/\.$/, '');
    t = t.charAt(0).toLowerCase() + t.slice(1);
    result = `chore: ${t}`;
  } else {
    result = t;
  }

  if (leadingEmoji) {
    result = `${leadingEmoji} ${result}`;
  }
  return result;
};

export const checkCandidate = (candidate: CommitCandidate): string[] => {
  const errs: string[] = [];
  // Length not programmatically enforced; rely on prompt guidance (50/72 convention).
  if (!CONVENTIONAL_RE.test(candidate.title)) {
    errs.push('Not a valid conventional commit title.');
  }
  if (/^[A-Z]/.test(candidate.title)) {
    // optional stylistic—imperative often begins with a verb; we skip heavy NLP
  }
  const body = candidate.body || '';
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(body)) {
      errs.push('Potential secret detected.');
      break;
    }
  }
  return errs;
};
