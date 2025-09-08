import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AppConfig } from '../config.js';
import { buildRefineMessages } from '../prompt.js';
import { formatCommitTitle } from '../title-format.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { CommitPlan } from '../types.js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
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

function saveSession(session: StoredSession) {
  const dir = '.git/.aicc-cache';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'last-session.json'), JSON.stringify(session, null, 2));
}

import {
  animateHeaderBase,
  borderLine,
  sectionTitle,
  abortMessage,
  createPhasedSpinner,
  renderCommitBlock,
  finalSuccess,
} from './ui.js';

export async function runRefine(config: AppConfig, options: any) {
  const startedAt = Date.now();
  const session = loadSession();
  if (!session) {
    console.log('No previous session found.');
    return;
  }
  const plan = session.plan;
  const index = options.index ? Number(options.index) - 1 : 0;
  if (!plan.commits[index]) {
    console.log('Invalid index.');
    return;
  }

  if (process.stdout.isTTY) {
    await animateHeaderBase(`ai-conventional-commit (using model ${config.model})`);
    borderLine();
  }

  sectionTitle('Original');
  const original = plan.commits[index];
  const originalLines: string[] = [chalk.yellow(original.title)];
  if (original.body) {
    original.body.split('\n').forEach((line) => {
      if (line.trim().length === 0) originalLines.push('');
      else originalLines.push(chalk.white(line));
    });
  }
  originalLines.forEach((l) => (l.trim().length === 0 ? borderLine() : borderLine(l)));
  borderLine();

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

  const phased = createPhasedSpinner(ora);
  const runStep = <T>(label: string, fn: () => Promise<T>) => phased.step(label, fn);

  const provider = new OpenCodeProvider(config.model);
  const messages = await runStep('Building prompt', async () =>
    buildRefineMessages({ originalPlan: plan, index, instructions, config }),
  );
  const raw = await runStep('Calling model', async () =>
    provider.chat(messages, { maxTokens: config.maxTokens }),
  );
  const refinedPlan: CommitPlan = await runStep('Parsing response', async () => extractJSON(raw));

  refinedPlan.commits[0].title = formatCommitTitle(refinedPlan.commits[0].title, {
    allowGitmoji: !!config.gitmoji || !!options.emoji,
    mode: (config.gitmojiMode as any) || 'standard',
  });

  phased.phase('Suggested commit');
  phased.stop();
  sectionTitle('Suggested commit');

  renderCommitBlock({
    title: refinedPlan.commits[0].title,
    body: refinedPlan.commits[0].body,
    titleColor: (s) => chalk.yellow(s),
  });

  borderLine();
  const { ok } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ok',
      message: 'Use the commit?',
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

  session.plan.commits[index] = refinedPlan.commits[0];
  saveSession(session);
  borderLine();
  finalSuccess({ count: 1, startedAt });
}
