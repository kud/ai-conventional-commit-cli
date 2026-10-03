import type { CommitCandidate } from './types.js';

const SECRET_PATTERNS = [
  /AWS_[A-Z0-9_]+/i,
  /BEGIN RSA PRIVATE KEY/,
  /-----BEGIN PRIVATE KEY-----/,
  /ssh-rsa AAAA/,
];

const CONVENTIONAL_RE =
  /^(?:((?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+)\s+(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert|merge|security|release)(\(.+\))?:\s|((?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+):\s.*|((?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+):\s*$|(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert|merge|security|release)(\(.+\))?:\s)/u;

// A leading tracker key, as in `SHOP-4518: ✨ feat(auth): …` or `SHOP-1 / SHOP-2: …`. It is not a
// conventional type, so normalisation must carry it through untouched rather than read it as one.
// Keys are matched case-insensitively and uppercased; a leading emoji cluster (as in
// `✨ ABC-1234: feat: …`) is moved to the front of `rest` unless `rest` already starts
// with one, in which case the leading one is dropped. The leading cluster must be
// followed by whitespace so a plain `ABC-1234` digit run (digits are \p{Emoji}) is
// never consumed as emoji.
const TICKET_PREFIX_RE =
  /^(?:((?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+)\s+)?([A-Z][A-Z0-9]+-\d+(?:\s*\/\s*[A-Z][A-Z0-9]+-\d+)*):\s+/iu;

const EMOJI_START_RE = /^(?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})/u;

// An emoji is a grapheme, not a codepoint: `♻️` is U+267B plus the U+FE0F variation
// selector, and ZWJ sequences and keycaps carry more. Keeping only the first codepoint
// strands the rest in front of the type, which then no longer parses (issue #7), so
// every emoji match here and in title-format.ts also admits U+FE0F, U+200D and U+20E3.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const firstGrapheme = (text: string): string =>
  graphemes.segment(text)[Symbol.iterator]().next().value?.segment ?? '';

export const splitTicketPrefix = (title: string): { prefix: string; rest: string } => {
  const trimmed = title.trim();
  const m = trimmed.match(TICKET_PREFIX_RE);
  if (!m) return { prefix: '', rest: trimmed };
  const leadingEmoji = m[1] ?? '';
  const keys = m[2].toUpperCase();
  const after = trimmed.slice(m[0].length);
  let rest = after;
  if (leadingEmoji && !EMOJI_START_RE.test(after)) {
    rest = `${leadingEmoji} ${after}`;
  }
  return { prefix: `${keys}: `, rest };
};

export const sanitizeTitle = (title: string, allowEmoji: boolean): string => {
  let t = title.trim();
  if (allowEmoji) {
    // If multiple leading emoji/punctuation tokens, collapse to a single emoji then a space
    const multi = t.match(
      /^((?:(?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+)(?:[\p{Emoji}\p{So}\p{Sk}\s]|\u{FE0F}|\u{200D}|\u{20E3})*)+/u,
    );
    if (multi) {
      // Keep only the first visible symbol
      const first = firstGrapheme(multi[0].trim());
      t = first + ' ' + t.slice(multi[0].length).trimStart();
    }
  } else {
    // Strip all leading emoji/symbol/punctuation clusters entirely
    t = t
      .replace(/^((?:[\p{Emoji}\p{So}\p{Sk}\p{P}]|\u{FE0F}|\u{200D}|\u{20E3})+\s*)+/u, '')
      .trimStart();
  }
  return t;
};

export const normalizeConventionalTitle = (title: string): string => {
  const original = title.trim();
  // Capture first emoji (if any) to optionally preserve
  let leadingEmoji = '';
  const emojiCluster = original.match(/^(?:[\p{Emoji}\p{So}\p{Sk}]|\u{FE0F}|\u{200D}|\u{20E3})+/u);
  if (emojiCluster) {
    leadingEmoji = firstGrapheme(emojiCluster[0]);
  }
  // Remove all leading emoji/symbol/punctuation clusters for normalization
  let t = original
    .replace(/^((?:[\p{Emoji}\p{So}\p{Sk}\p{P}]|\u{FE0F}|\u{200D}|\u{20E3})+\s*)+/u, '')
    .trim();

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
  if (!CONVENTIONAL_RE.test(splitTicketPrefix(candidate.title).rest)) {
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
