import { AppConfig } from './config.js';
import { StyleProfile, CommitPlan } from './types.js';
import { FileDiff } from './types.js';

export const summarizeDiffForPrompt = (
  files: FileDiff[],
  privacy: AppConfig['privacy'],
): string => {
  if (privacy === 'high') {
    return files
      .map((f) => `file: ${f.file} (+${f.additions} -${f.deletions}) hunks:${f.hunks.length}`)
      .join('\n');
  }
  if (privacy === 'medium') {
    return files
      .map(
        (f) =>
          `file: ${f.file}\n` +
          f.hunks
            .map(
              (h) =>
                `  hunk ${h.hash} context:${h.functionContext || ''} +${h.added} -${h.removed}`,
            )
            .join('\n'),
      )
      .join('\n');
  }
  // low
  return files
    .map(
      (f) =>
        `file: ${f.file}\n` +
        f.hunks
          .map(
            (h) =>
              `${h.header}\n${h.lines
                .slice(0, 40)
                .join('\n')}${h.lines.length > 40 ? '\n[truncated]' : ''}`,
          )
          .join('\n'),
    )
    .join('\n');
};

export const buildGenerationMessages = (opts: {
  files: FileDiff[];
  style: StyleProfile;
  config: AppConfig;
  mode: 'single' | 'split';
  desiredCommits?: number;
}): Array<{ role: 'system' | 'user'; content: string }> => {
  const { files, style, config, mode, desiredCommits } = opts;
  const diff = summarizeDiffForPrompt(files, config.privacy);
  const TYPE_MAP = {
    feat: 'A new feature or capability added for the user',
    fix: 'A bug fix resolving incorrect behavior',
    chore: 'Internal change with no user-facing impact',
    docs: 'Documentation-only changes',
    refactor: 'Code change that neither fixes a bug nor adds a feature',
    test: 'Adding or improving tests only',
    ci: 'Changes to CI configuration or scripts',
    perf: 'Performance improvement',
    style: 'Formatting or stylistic change (no logic)',
    build: 'Build system or dependency changes',
    revert: 'Revert a previous commit',
    merge: 'Merge branches (rare; only if truly a merge commit)',
    security: 'Security-related change or hardening',
    release: 'Version bump or release meta change',
  } as const;

  const specLines: string[] = [];
  specLines.push(
    'Purpose: Generate high-quality Conventional Commit messages for the provided git diff.',
  );
  specLines.push('Locale: en');
  specLines.push(
    'Output JSON Schema: { "commits": [ { "title": string, "body": string, "score": 0-100, "reasons": string[], "files"?: string[] } ], "meta": { "splitRecommended": boolean } }',
  );
  specLines.push('Primary Output Field: commits[ ].title');
  specLines.push('Title Format: <type>(<optional-scope>): <subject>');
  specLines.push('Max Title Length: 72 characters (hard limit)');
  specLines.push('Types (JSON mapping follows on next line)');
  specLines.push('TypeMap: ' + JSON.stringify(TYPE_MAP));
  specLines.push('Scope Rules: optional; if present, lowercase kebab-case; omit when unclear.');
  specLines.push(
    'Subject Rules: imperative mood, present tense, no leading capital unless proper noun, no trailing period.',
  );
  specLines.push('Length Rule: Entire title line (including type/scope) must be <= 72 chars.');
  specLines.push(
    'Emoji Rule: ' +
      (config.gitmoji
        ? 'OPTIONAL single leading gitmoji BEFORE the type only if confidently adds clarity; do not invent or stack; omit if unsure.'
        : 'Disallow all emojis and gitmoji codes; output must start directly with the type.'),
  );
  specLines.push(
    'Forbidden: breaking changes notation, exclamation mark after type unless truly semver-major (avoid unless diff clearly indicates).',
  );
  specLines.push('Fallback Type: use chore when no other type clearly fits.');
  specLines.push('Consistency: prefer existing top prefixes: ' + style.topPrefixes.join(', '));
  specLines.push('Provide score (0-100) measuring clarity & specificity (higher is better).');
  specLines.push(
    'Provide reasons array citing concrete diff elements: filenames, functions, tests, metrics.',
  );
  specLines.push(
    'When mode is split, WHERE POSSIBLE add a "files" array per commit listing the most relevant changed file paths (1-6, minimize overlap across commits).',
  );

  specLines.push('Return ONLY the JSON object. No surrounding text or markdown.');
  specLines.push('Do not add fields not listed in schema.');
  specLines.push('Never fabricate content not present or implied by the diff.');
  specLines.push(
    'If mode is split and multiple logical changes exist, set meta.splitRecommended=true.',
  );

  return [
    {
      role: 'system',
      content: specLines.join('\n'),
    },
    {
      role: 'user',
      content: `Mode: ${mode}\nRequestedCommitCount: ${desiredCommits || (mode === 'split' ? '2-6' : 1)}\nStyleFingerprint: ${JSON.stringify(style)}\nDiff:\n${diff}\nGenerate commit candidates now.`,
    },
  ];
};

export const buildRefineMessages = (opts: {
  originalPlan: CommitPlan;
  index: number;
  instructions: string[];
  config: AppConfig;
}): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> => {
  const { originalPlan, index, instructions, config } = opts;
  const target = originalPlan.commits[index];
  const spec: string[] = [];
  spec.push('Purpose: Refine a single Conventional Commit message while preserving intent.');
  spec.push('Locale: en');
  spec.push('Input: one existing commit JSON object.');
  spec.push(
    'Output JSON Schema: { "commits": [ { "title": string, "body": string, "score": 0-100, "reasons": string[] } ] }',
  );
  spec.push('Title Format: <type>(<optional-scope>): <subject> (<=72 chars)');
  spec.push('Subject: imperative, present tense, no trailing period.');
  spec.push(
    'Emoji Rule: ' +
      (config.gitmoji
        ? 'OPTIONAL single leading gitmoji BEFORE type if it adds clarity; omit if unsure.'
        : 'Disallow all emojis; start directly with the type.'),
  );
  spec.push('Preserve semantic meaning; only improve clarity, scope, brevity, conformity.');
  spec.push('If instructions request scope or emoji, incorporate only if justified by content.');
  spec.push('Return ONLY JSON (commits array length=1).');

  return [
    { role: 'system', content: spec.join('\n') },
    {
      role: 'user',
      content: `Current commit object:\n${JSON.stringify(target, null, 2)}\nInstructions:\n${instructions.join('\n') || 'None'}\nRefine now.`,
    },
  ];
};
