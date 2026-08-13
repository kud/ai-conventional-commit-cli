import chalk from 'chalk';
import ora from 'ora';
import type { AppConfig } from '../config.js';
import { getCacheDir } from '../config.js';
import {
  getStagedFilesAndDiff,
  getRecentCommitMessages,
  createCommit,
  resetIndex,
  stageFiles,
} from '../git.js';
import type { CommitFailure } from '../git.js';
import { buildStyleProfile } from '../style.js';
import { buildGenerationMessages } from '../prompt.js';
import { clusterHunks } from '../cluster.js';
import type { Provider } from '../model/provider.js';
import { createProvider, extractJSON } from '../model/provider.js';
import { loadPlugins, applyTransforms } from '../plugins.js';
import { formatCommitTitle } from '../title-format.js';
import type { CommitPlan } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { select } from '@inquirer/prompts';

import {
  animateHeaderBase,
  borderLine,
  sectionTitle,
  abortMessage,
  createPhasedSpinner,
  renderCommitBlock,
  finalSuccess,
  commitFailureOutput,
  commitFailureMessage,
} from './ui.js';

export async function runSplit(config: AppConfig, desired?: number): Promise<number | void> {
  const startedAt = Date.now();
  const provider = createProvider(config.model);
  provider.warmup();
  try {
    return await _runSplit(provider, config, desired, startedAt);
  } finally {
    await provider.close();
  }
}

async function _runSplit(
  provider: Provider,
  config: AppConfig,
  desired: number | undefined,
  startedAt: number,
): Promise<number | void> {
  const { files, hasStagedChanges } = await getStagedFilesAndDiff();
  if (!hasStagedChanges) {
    console.log('No staged changes.');
    return;
  }
  if (!files.length) {
    console.log('No diff content detected after staging. Aborting.');
    return;
  }

  if (process.stdout.isTTY) {
    await animateHeaderBase('ai-conventional-commit', config.model);
    borderLine();
  }

  sectionTitle('Files');
  (function renderDiffStat() {
    const BAR_WIDTH = 32;
    const nameLens = files.map((f) => f.file.length);
    const maxName = Math.min(Math.max(...nameLens, 0), 50);
    const deltas = files.map((f) => (f.additions || 0) + (f.deletions || 0));
    const maxDelta = Math.max(...deltas, 1);

    borderLine(
      chalk.dim(`Detected ${files.length} staged ${files.length === 1 ? 'file' : 'files'}:`),
    );

    let totalAdd = 0;
    let totalDel = 0;

    files.forEach((f) => {
      const add = f.additions || 0;
      const del = f.deletions || 0;
      totalAdd += add;
      totalDel += del;

      const name = f.file.length > maxName ? f.file.slice(0, maxName - 1) + '…' : f.file;
      let line = name.padEnd(maxName) + ' | ';

      if ((f as any).deleted) {
        line += chalk.red('[deleted]');
      } else {
        const delta = add + del;
        const counts = chalk.green('+' + add) + ' ' + chalk.red('-' + del);
        line += counts.padEnd(12);
        if (delta > 0) {
          const barLen = Math.max(1, Math.round((delta / maxDelta) * BAR_WIDTH));
          const addPortion = Math.min(barLen, Math.round(barLen * (add / (delta || 1))));
          const delPortion = barLen - addPortion;
          const bar = chalk.green('+'.repeat(addPortion)) + chalk.red('-'.repeat(delPortion));
          line += ' ' + bar;
        }
      }
      borderLine(line);
    });

    borderLine(
      chalk.dim(
        `${files.length} file${files.length === 1 ? '' : 's'} changed, ` +
          `${totalAdd} insertion${totalAdd === 1 ? '' : 's'}(+), ` +
          `${totalDel} deletion${totalDel === 1 ? '' : 's'}(-)`,
      ),
    );
    borderLine();
  })();

  const phased = createPhasedSpinner(ora);
  const runStep = <T>(label: string, fn: () => Promise<T>) => phased.step(label, fn);

  clusterHunks(files);
  const [style, plugins] = await runStep('Profiling style', async () =>
    Promise.all([
      getRecentCommitMessages(config.styleSamples).then(buildStyleProfile),
      loadPlugins(config),
    ]),
  );
  const messages = await runStep('Building prompt', async () =>
    buildGenerationMessages({ files, style, config, mode: 'split', desiredCommits: desired }),
  );
  const raw = await runStep('Calling model', async () =>
    provider.chat(messages, { maxTokens: config.maxTokens }),
  );
  const plan: CommitPlan = await runStep('Parsing response', async () => extractJSON(raw));
  let candidates = await runStep('Analyzing changes', async () =>
    applyTransforms(plan.commits, plugins, { cwd: process.cwd(), env: process.env }),
  );

  // Suggested commits step (plural aware)
  const plural = candidates.length !== 1;
  phased.phase(plural ? 'Suggested commits' : 'Suggested commit');
  phased.stop();
  sectionTitle(plural ? 'Suggested commits' : 'Suggested commit');
  // extra spacer line after section title per user request
  borderLine();

  candidates = candidates.map((c) => ({
    ...c,
    title: formatCommitTitle(c.title, {
      allowGitmoji: config.style === 'gitmoji' || config.style === 'gitmoji-pure',
      mode: config.style,
    }),
  }));

  const fancy = candidates.length > 1;
  candidates.forEach((c, idx) => {
    renderCommitBlock({
      title: c.title,
      body: c.body,
      heading: fancy ? `Commit n°${idx + 1}` : undefined,
      hideMessageLabel: fancy,
      fancy,
    });
    if (idx < candidates.length - 1) {
      borderLine();
      borderLine();
    }
  });

  borderLine();
  const ok =
    config.yes ||
    (await select({
      message: 'Use the commits?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: true,
    }));

  if (!ok) {
    borderLine();
    abortMessage();
    return;
  }

  // Build file mapping for selective staging
  const allChangedFiles = [...new Set(files.map((f) => f.file))];
  // Heuristic: if commits provided files arrays with coverage & minimal overlap, use them.
  let useFiles = false;
  if (candidates.every((c) => Array.isArray(c.files) && c.files!.length > 0)) {
    const flat = candidates.flatMap((c) => c.files!);
    const unique = new Set(flat);
    // basic sanity: subset of changed files
    if ([...unique].every((f) => allChangedFiles.includes(f))) {
      useFiles = true;
    }
  }
  // Fallback simple deterministic partition if not provided: round-robin assign files
  if (!useFiles) {
    const buckets: string[][] = candidates.map(() => []);
    allChangedFiles.forEach((f, i) => buckets[i % buckets.length].push(f));
    candidates = candidates.map((c, i) => ({ ...c, files: buckets[i] }));
  }

  // Commit loop with selective staging
  let success = 0;
  const failed: string[] = [];
  let lastFailure: CommitFailure | undefined;
  // A hook rejects every candidate for the same reason, so its report is printed once
  // per distinct message rather than once per commit.
  const reportedOutput = new Set<string>();
  for (const candidate of candidates) {
    // reset index (keep worktree)
    await resetIndex();
    if (!candidate.files?.length) continue;
    await stageFiles(candidate.files);
    const commit = await createCommit(candidate.title, candidate.body);
    if (commit.ok) {
      success++;
      continue;
    }
    failed.push(candidate.title);
    lastFailure = commit.failure;
    if (!reportedOutput.has(commit.failure.output)) {
      reportedOutput.add(commit.failure.output);
      commitFailureOutput(commit.failure);
    }
  }
  if (failed.length) {
    borderLine();
    console.error(
      chalk.yellow(
        `${failed.length} commit(s) failed and were skipped (files remain staged/unstaged): ` +
          failed.join(', '),
      ),
    );
  }
  // After loop, ensure no leftover unstaged changes (stage and append to last commit?) – choose to leave them unstaged so user can run again.
  borderLine();
  if (lastFailure) commitFailureMessage(lastFailure);
  if (success) finalSuccess({ count: success, startedAt });

  saveSession({ plan, chosen: candidates, mode: 'split' });
  if (lastFailure) return lastFailure.exitCode;
}

function saveSession(data: any) {
  const dir = getCacheDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'last-session.json'), JSON.stringify(data, null, 2));
}
