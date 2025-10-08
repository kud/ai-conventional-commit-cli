import chalk from 'chalk';
import ora from 'ora';
import { AppConfig } from '../config.js';
import { ensureStagedChanges, parseDiff, getRecentCommitMessages, createCommit } from '../git.js';
import { buildStyleProfile } from '../style.js';
import { buildGenerationMessages } from '../prompt.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { loadPlugins, applyTransforms, runValidations } from '../plugins.js';
import { checkCandidate } from '../guardrails.js';
import { formatCommitTitle } from '../title-format.js';
import { CommitCandidate, CommitPlan } from '../types.js';
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

export async function runGenerate(config: AppConfig) {
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
    borderLine(); // blank spacer with left border
  }

  // Step: Files
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

      const delta = add + del;
      const barLen = Math.max(1, Math.round((delta / maxDelta) * BAR_WIDTH));
      const addPortion = Math.min(barLen, Math.round(barLen * (add / (delta || 1))));
      const delPortion = barLen - addPortion;
      const bar = chalk.green('+'.repeat(addPortion)) + chalk.red('-'.repeat(delPortion));
      const counts = chalk.green('+' + add) + ' ' + chalk.red('-' + del);
      let name = f.file.length > maxName ? f.file.slice(0, maxName - 1) + '…' : f.file;
      if ((f as any).deleted) {
        name += ' ' + chalk.red('[deleted]');
      }
      borderLine(name.padEnd(maxName) + ' | ' + counts.padEnd(12) + ' ' + bar);
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

  let style: any;
  let plugins: any;
  let messages: any;
  let raw: string | undefined;
  let plan: CommitPlan | undefined;
  let candidates: CommitCandidate[] = [];
  const provider = new OpenCodeProvider(config.model);

  style = await runStep('Profiling style', async () => {
    const history = await getRecentCommitMessages(config.styleSamples);
    return buildStyleProfile(history);
  });
  plugins = await runStep('Loading plugins', async () => loadPlugins(config));
  messages = await runStep('Building prompt', async () =>
    buildGenerationMessages({ files, style, config, mode: 'single' }),
  );
  raw = await runStep('Calling model', async () =>
    provider.chat(messages, { maxTokens: config.maxTokens }),
  );
  plan = await runStep('Parsing response', async () => extractJSON(raw!));
  candidates = await runStep('Analyzing changes', async () =>
    applyTransforms(plan!.commits, plugins, { cwd: process.cwd(), env: process.env }),
  );

  // Suggested commit step
  phased.phase('Suggested commit');
  phased.stop();
  sectionTitle('Suggested commit');

  candidates = candidates.map((c) => ({
    ...c,
    title: formatCommitTitle(c.title, {
      allowGitmoji: config.style === 'gitmoji' || config.style === 'gitmoji-pure',
      mode: config.style,
    }),
  }));
  const chosen = candidates[0];

  renderCommitBlock({ title: chosen.title, body: chosen.body });

  const pluginErrors = await runValidations(chosen, plugins, {
    cwd: process.cwd(),
    env: process.env,
  });
  const guardErrors = checkCandidate(chosen);
  const errors = [...pluginErrors, ...guardErrors];

  if (errors.length) {
    borderLine();
    console.log('⊙ ' + chalk.bold('Checks'));
    const errorLines = ['Validation issues:', ...errors.map((e) => chalk.red('• ' + e))];
    errorLines.forEach((l) => borderLine(l));
  }
  borderLine();
  const yn = await selectYesNo();
  if (!yn) {
    borderLine();
    abortMessage();
    return;
  }
  await createCommit(chosen.title, chosen.body);
  saveSession({ plan, chosen, mode: 'single' });
  borderLine();
  finalSuccess({ count: 1, startedAt });
}

function saveSession(data: any) {
  const dir = '.git/.aicc-cache';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'last-session.json'), JSON.stringify(data, null, 2));
}

async function selectYesNo(): Promise<boolean> {
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'Use the commit?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: 0,
    },
  ]);
  return choice as boolean;
}
