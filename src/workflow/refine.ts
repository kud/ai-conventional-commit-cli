import chalk from 'chalk';
import ora from 'ora';
import { AppConfig } from '../config.js';
import { buildRefineMessages } from '../prompt.js';
import { formatCommitTitle } from '../title-format.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { CommitPlan } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { prompt } from './util.js';

interface StoredSession {
  plan: CommitPlan;
  chosen: any;
  mode: string;
}

function loadSession(): StoredSession | null {
  const path = join('.git/.aicc-cache', 'last-session.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export async function runRefine(config: AppConfig, options: any) {
  const spinner = ora('Loading last session').start();
  const session = loadSession();
  if (!session) {
    spinner.fail('No previous session found.');
    return;
  }
  spinner.succeed('Session loaded');

  const plan = session.plan;
  const index = options.index ?? 0;
  if (!plan.commits[index]) {
    console.log('Invalid index.');
    return;
  }

  const instructions: string[] = [];
  if (options.shorter) instructions.push('Make the title shorter but keep meaning.');
  if (options.longer) instructions.push('Add more specificity to the title.');
  if (options.scope) instructions.push(`Add or adjust scope to: ${options.scope}`);
  if (options.emoji) instructions.push('Add a relevant emoji prefix.');

  if (!instructions.length) {
    const add = await prompt('No refinement flags given. Enter custom instruction: ');
    if (add.trim()) instructions.push(add.trim());
    else {
      console.log('Nothing to refine.');
      return;
    }
  }

  const provider = new OpenCodeProvider(config.model);

  const messages = buildRefineMessages({
    originalPlan: plan,
    index,
    instructions,
    config,
  });

  const raw = await provider.chat(messages, { maxTokens: config.maxTokens });
  let refined: CommitPlan;
  try {
    refined = extractJSON(raw);
  } catch (e: any) {
    console.error('Failed to parse refine response:', e.message);
    return;
  }

  {
    refined.commits[0].title = formatCommitTitle(refined.commits[0].title, {
      allowGitmoji: !!config.gitmoji || !!options.emoji,
      mode: (config.gitmojiMode as any) || 'standard',
    });
  }

  console.log(chalk.cyan('\nRefined candidate:'));
  console.log(chalk.yellow(refined.commits[0].title));
  if (refined.commits[0].body) {
    const indent = '   ';
    refined.commits[0].body.split('\n').forEach((line) => {
      if (line.trim().length === 0) console.log(indent);
      else console.log(indent + chalk.gray(line));
    });
  }

  const accept = await prompt('Accept refined version? (Y/n) ', 'y');
  if (!/^n/i.test(accept)) {
    plan.commits[index] = refined.commits[0];
    console.log(chalk.green('Refinement stored (not retro-committed).'));
  } else {
    console.log('Refinement discarded.');
  }
}
