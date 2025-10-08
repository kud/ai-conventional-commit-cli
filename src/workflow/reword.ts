import chalk from 'chalk';
import ora from 'ora';
import { AppConfig } from '../config.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { formatCommitTitle } from '../title-format.js';
import { buildRefineMessages } from '../prompt.js';
import { animateHeaderBase, borderLine, sectionTitle, renderCommitBlock } from './ui.js';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import { CommitPlan } from '../types.js';

const git = simpleGit();

async function getCommitMessage(
  hash: string,
): Promise<{ title: string; body?: string; parents: string[] } | null> {
  try {
    const raw = await git.show([`${hash}`, '--quiet', '--format=%P%n%B']);
    const lines = raw.split('\n');
    const parentsLine = lines.shift() || '';
    const parents = parentsLine.trim().length ? parentsLine.trim().split(/\s+/) : [];
    const message = lines.join('\n').trim();
    if (!message) return null;
    const [first, ...rest] = message.split('\n');
    const body = rest.join('\n').trim() || undefined;
    return { title: first, body, parents };
  } catch {
    return null;
  }
}

export async function runReword(config: AppConfig, hash: string) {
  const startedAt = Date.now();
  const commit = await getCommitMessage(hash);
  if (!commit) {
    console.log(`Commit not found: ${hash}`);
    return;
  }
  if (commit.parents.length > 1) {
    console.log('Refusing to reword a merge commit (multiple parents).');
    return;
  }

  if (process.stdout.isTTY) {
    await animateHeaderBase('ai-conventional-commit', config.model);
    borderLine();
  }

  sectionTitle('Original commit');
  borderLine(chalk.yellow(commit.title));
  if (commit.body) {
    commit.body.split('\n').forEach((l) => (l.trim().length ? borderLine(l) : borderLine()));
  }
  borderLine();

  const instructions: string[] = [
    'Improve clarity & conformity to Conventional Commits while preserving meaning.',
  ];

  const syntheticPlan: CommitPlan = {
    commits: [
      {
        title: commit.title,
        body: commit.body,
        score: 0,
        reasons: [],
      },
    ],
  };

  const provider = new OpenCodeProvider(config.model);
  const spinner = ora({ text: 'Calling model', spinner: 'dots' }).start();
  let refined: CommitPlan | null = null;
  try {
    const messages = buildRefineMessages({
      originalPlan: syntheticPlan,
      index: 0,
      instructions,
      config,
    });
    const raw = await provider.chat(messages, { maxTokens: config.maxTokens });
    refined = await extractJSON(raw);
  } catch (e: any) {
    spinner.fail('Model call failed: ' + (e?.message || e));
    return;
  }
  spinner.stop();

  if (!refined || !refined.commits.length) {
    console.log('No refined commit produced.');
    return;
  }
  const candidate = refined.commits[0];
  candidate.title = formatCommitTitle(candidate.title, {
    allowGitmoji: config.style === 'gitmoji' || config.style === 'gitmoji-pure',
    mode: config.style,
  });

  sectionTitle('Proposed commit');
  renderCommitBlock({
    title: chalk.yellow(candidate.title),
    body: candidate.body,
    hideMessageLabel: true,
  });
  borderLine();

  const isHead =
    (await git.revparse(['HEAD'])).startsWith(hash) ||
    (await git.revparse([hash])) === (await git.revparse(['HEAD']));

  const { ok } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ok',
      message: isHead
        ? 'Amend HEAD with this message?'
        : 'Use this new message (show rebase instructions)?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: 0,
    },
  ]);
  if (!ok) {
    borderLine('Aborted.');
    return;
  }

  if (isHead) {
    const full = candidate.body ? `${candidate.title}\n\n${candidate.body}` : candidate.title;
    try {
      await git.commit(full, { '--amend': null });
      borderLine('Amended HEAD.');
    } catch (e: any) {
      borderLine('Failed to amend: ' + (e?.message || e));
    }
  } else {
    const full = candidate.body ? `${candidate.title}\n\n${candidate.body}` : candidate.title;
    sectionTitle('Apply manually');
    borderLine('Interactive rebase steps:');
    borderLine(`1. git rebase -i ${hash}~1 --reword`);
    borderLine(
      '2. In the editor, ensure the line for the commit is kept as reword (or change pick → reword).',
    );
    borderLine('3. When prompted, replace the message with below:');
    borderLine();
    borderLine(candidate.title);
    if (candidate.body) {
      candidate.body.split('\n').forEach((l) => (l.trim().length ? borderLine(l) : borderLine()));
    }
    borderLine();
  }
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1) + 's';
  borderLine(`Done in ${elapsed}.`);
}
