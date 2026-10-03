import type { StyleProfile } from './types.js';
import { splitTicketPrefix } from './guardrails.js';

const LEADING_GITMOJI_RE = /^(?:\p{Extended_Pictographic}|\u{FE0F}|\u{200D})+\s*/u;
const CONVENTIONAL_TITLE_RE =
  /^(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert|merge|security|release)(\(.+\))?: /;

// Titles such as `SHOP-12: ✨ feat(auth): …` carry their type behind a ticket key and a
// gitmoji. Reading the raw title found no type in them, so a gitmoji history profiled as
// scopeless and non-conventional, and the prompt then contradicted its own scope rule.
const splitTitle = (title: string): { gitmoji: boolean; rest: string } => {
  const { rest } = splitTicketPrefix(title);
  const emoji = rest.match(LEADING_GITMOJI_RE);
  return { gitmoji: Boolean(emoji), rest: emoji ? rest.slice(emoji[0].length) : rest };
};

export const buildStyleProfile = (messages: string[]): StyleProfile => {
  if (!messages.length) {
    return {
      tense: 'imperative',
      avgTitleLength: 50,
      usesScopes: false,
      gitmojiRatio: 0,
      topPrefixes: [],
      conventionalRatio: 0,
    };
  }
  const titles = messages.map((m) => m.split('\n')[0]);
  const parts = titles.map(splitTitle);
  const avgTitleLength = titles.reduce((a, c) => a + c.length, 0) / Math.max(1, titles.length);
  const gitmojiCount = parts.filter((p) => p.gitmoji).length;
  const usesScopesCount = parts.filter((p) => /^\w+\(.+\):/.test(p.rest)).length;
  const conventionalCount = parts.filter((p) => CONVENTIONAL_TITLE_RE.test(p.rest)).length;
  const prefixes = new Map<string, number>();
  for (const { rest } of parts) {
    const m = rest.match(CONVENTIONAL_TITLE_RE);
    if (m) prefixes.set(m[1], (prefixes.get(m[1]) || 0) + 1);
  }
  const topPrefixes = [...prefixes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    tense: 'imperative',
    avgTitleLength,
    usesScopes: usesScopesCount / titles.length > 0.25,
    gitmojiRatio: gitmojiCount / titles.length,
    topPrefixes,
    conventionalRatio: conventionalCount / titles.length,
  };
};
