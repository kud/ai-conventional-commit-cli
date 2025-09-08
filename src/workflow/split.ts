import chalk from 'chalk';
import ora from 'ora';
import { AppConfig } from '../config.js';
import {
  ensureStagedChanges,
  parseDiff,
  getRecentCommitMessages,
  createCommit,
  resetIndex,
  stageFiles,
  getStagedFiles,
} from '../git.js';
import { buildStyleProfile } from '../style.js';
import { buildGenerationMessages } from '../prompt.js';
import { clusterHunks } from '../cluster.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { loadPlugins, applyTransforms } from '../plugins.js';
import { formatCommitTitle } from '../title-format.js';
import { CommitPlan } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import inquirer from 'inquirer';

import {
  animateHeaderBase,
  borderLine,
  sectionTitle,
  abortMessage,
  createPhasedSpinner,
  renderCommitBlock,
  finalSuccess,
} from './ui.js';

export async function runSplit(config: AppConfig, desired?: number) {
  const startedAt = Date.now();
  if (!(await ensureStagedChanges())) {
    console.log('No staged changes.');
    return;
  }
  const files = await parseDiff();
  if (!files.length) {
    console.log('No diff content detected after staging. Aborting.');
    return;
  }

  if (process.stdout.isTTY) {
    await animateHeaderBase('ai-conventional-commit', config.model);
    borderLine();
  }

  sectionTitle('Files');
  borderLine(
    chalk.dim(`Detected ${files.length} staged ${files.length === 1 ? 'file' : 'files'}:`),
  );
  files.forEach((f) => borderLine('• ' + f.file));
  borderLine();

  const phased = createPhasedSpinner(ora);
  const runStep = <T>(label: string, fn: () => Promise<T>) => phased.step(label, fn);

  await runStep('Clustering changes', async () => {
    clusterHunks(files);
  });
  const style = await runStep('Profiling style', async () => {
    const history = await getRecentCommitMessages(config.styleSamples);
    return buildStyleProfile(history);
  });
  const plugins = await runStep('Loading plugins', async () => loadPlugins(config));
  const messages = await runStep('Building prompt', async () =>
    buildGenerationMessages({ files, style, config, mode: 'split', desiredCommits: desired }),
  );
  const provider = new OpenCodeProvider(config.model);
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
      allowGitmoji: !!config.gitmoji,
      mode: (config.gitmojiMode as any) || 'standard',
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
  const { ok } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ok',
      message: 'Use the commits?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: 0,
    },
  ]);

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
    useFiles = true;
  }

  // Commit loop with selective staging
  let success = 0;
  // Snapshot working tree staged files already consumed implicitly; we re-stage subsets each iteration.
  // fullFiles snapshot not currently used; could restore later
  for (const candidate of candidates) {
    // reset index (keep worktree)
    await resetIndex();
    await stageFiles(candidate.files || []);
    const stagedNow = await getStagedFiles();
    if (!stagedNow.length) continue; // skip empty
    try {
      await createCommit(candidate.title, candidate.body);
      success++;
    } catch (e) {
      // skip on failure, continue
    }
  }
  // After loop, ensure no leftover unstaged changes (stage and append to last commit?) – choose to leave them unstaged so user can run again.
  borderLine();
  finalSuccess({ count: success, startedAt });

  saveSession({ plan, chosen: candidates, mode: 'split' });
}

function saveSession(data: any) {
  const dir = '.git/.aicc-cache';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'last-session.json'), JSON.stringify(data, null, 2));
}
