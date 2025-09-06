import { StyleProfile } from './types.js';

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
  const avgTitleLength = titles.reduce((a, c) => a + c.length, 0) / Math.max(1, titles.length);
  const gitmojiCount = titles.filter((t) => /[\u{1F300}-\u{1FAFF}]/u.test(t)).length;
  const usesScopesCount = titles.filter((t) => /^\w+\(.+\):/.test(t)).length;
  const conventionalCount = titles.filter((t) =>
    /^(feat|fix|chore|docs|refactor|test|ci|perf|style)(\(.+\))?: /.test(t),
  ).length;
  const prefixes = new Map<string, number>();
  for (const t of titles) {
    const m = t.match(/^(\w+)(\(.+\))?:/);
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
