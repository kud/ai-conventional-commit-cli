import chalk from 'chalk';
import { AppConfig } from '../config.js';
import { ensureStagedChanges, parseDiff, getRecentCommitMessages, createCommit } from '../git.js';
import { buildStyleProfile } from '../style.js';
import { buildGenerationMessages } from '../prompt.js';
import { clusterHunks } from '../cluster.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { loadPlugins, applyTransforms, runValidations } from '../plugins.js';
import { checkCandidate } from '../guardrails.js';
import { formatCommitTitle } from '../title-format.js';
import { CommitPlan } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import inquirer from 'inquirer';

export async function runSplit(config: AppConfig, desired?: number) {
  if (!(await ensureStagedChanges())) {
    console.log('No staged changes.');
    return;
  }
  const files = await parseDiff();
  if (!files.length) {
    console.log('No diff content detected after staging. Aborting.');
    return;
  }
  console.log('◇  Clustering changes');
  clusterHunks(files); // clustering side-effects for future use (discarded)

  console.log('◇  Profiling style');
  const history = await getRecentCommitMessages(config.styleSamples);
  const style = buildStyleProfile(history);

  console.log('◇  Loading plugins');
  const plugins = await loadPlugins(config);

  console.log('◇  Building prompt');
  const messages = buildGenerationMessages({
    files,
    style,
    config,
    mode: 'split',
    desiredCommits: desired,
  });

  const provider = new OpenCodeProvider(config.model);

  console.log('◇  Calling model for split plan');
  let raw: string;
  try {
    raw = await provider.chat(messages, { maxTokens: config.maxTokens });
  } catch (e: any) {
    console.log(e.message);
    return;
  }

  console.log('◇  Parsing response');
  let plan: CommitPlan;
  try {
    plan = extractJSON(raw);
  } catch (e: any) {
    console.log('JSON parse error: ' + e.message);
    return;
  }
  console.log('◇  Plan received');

  let candidates = await applyTransforms(plan.commits, plugins, {
    cwd: process.cwd(),
    env: process.env,
  });

  candidates = candidates.map((c) => ({
    ...c,
    title: formatCommitTitle(c.title, {
      allowGitmoji: !!config.gitmoji,
      mode: (config.gitmojiMode as any) || 'standard',
    }),
  }));

  console.log(chalk.cyan('\nProposed commits:'));
  candidates.forEach((c) => {
    console.log(chalk.yellow(`• ${c.title}`));
    if (c.body) {
      const indent = '   ';
      c.body.split('\n').forEach((line) => {
        if (line.trim().length === 0) console.log(indent);
        else console.log(indent + chalk.gray(line));
      });
    }
  });

  // Single confirmation for all commits
  const { ok } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ok',
      message: 'Apply these commit messages?',
      choices: [
        { name: '● Yes', value: true },
        { name: '○ No', value: false },
      ],
      default: 0,
    },
  ]);

  if (!ok) {
    console.log('Aborted.');
    return;
  }

  for (const candidate of candidates) {
    const pluginErrors = await runValidations(candidate, plugins, {
      cwd: process.cwd(),
      env: process.env,
    });
    const guardErrors = checkCandidate(candidate);
    const errors = [...pluginErrors, ...guardErrors];
    if (errors.length) {
      console.log(chalk.red('Skipping commit due to errors:'), candidate.title);
      errors.forEach((e) => console.log(' -', e));
      continue;
    }
    await createCommit(candidate.title, candidate.body);
    console.log(chalk.green('Committed: ') + candidate.title);
  }

  saveSession({ plan, chosen: candidates, mode: 'split' });
}

function saveSession(data: any) {
  const dir = '.git/.aicc-cache';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'last-session.json'), JSON.stringify(data, null, 2));
}
