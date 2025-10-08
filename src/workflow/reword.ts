import chalk from 'chalk';
import ora from 'ora';
import { AppConfig } from '../config.js';
import { OpenCodeProvider, extractJSON } from '../model/provider.js';
import { formatCommitTitle } from '../title-format.js';
import { buildRefineMessages } from '../prompt.js';
import {
  animateHeaderBase,
  borderLine,
  sectionTitle,
  renderCommitBlock,
  abortMessage,
  finalSuccess,
  createPhasedSpinner,
} from './ui.js';
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

async function isAncestor(ancestor: string, head: string): Promise<boolean> {
  try {
    const mb = (await git.raw(['merge-base', ancestor, head])).trim();
    const anc = (await git.revparse([ancestor])).trim();
    return mb === anc;
  } catch {
    return false;
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
  const phased = createPhasedSpinner(ora);
  let refined: CommitPlan | null = null;
  try {
    phased.phase('Preparing prompt');
    const messages = buildRefineMessages({
      originalPlan: syntheticPlan,
      index: 0,
      instructions,
      config,
    });
    phased.phase('Calling model');
    const raw = await provider.chat(messages, { maxTokens: config.maxTokens });
    phased.phase('Parsing response');
    refined = await extractJSON(raw);
  } catch (e: any) {
    phased.spinner.fail('Reword failed: ' + (e?.message || e));
    return;
  }
  phased.stop();

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

  const resolvedHash = (await git.revparse([hash])).trim();
  const headHash = (await git.revparse(['HEAD'])).trim();
  const isHead = headHash === resolvedHash || headHash.startsWith(resolvedHash);

  const { ok } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ok',
      message: isHead ? 'Amend HEAD with this message?' : 'Apply rewrite (history will change)?',
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

  const full = candidate.body ? `${candidate.title}\n\n${candidate.body}` : candidate.title;

  if (isHead) {
    try {
      await git.commit(full, { '--amend': null });
    } catch (e: any) {
      borderLine('Failed to amend HEAD: ' + (e?.message || e));
      borderLine();
      abortMessage();
      return;
    }
    borderLine();
    finalSuccess({ count: 1, startedAt });
    return;
  }

  // Non-HEAD: attempt automatic history rewrite if linear & no merge commits in range
  const ancestorOk = await isAncestor(resolvedHash, headHash);
  if (!ancestorOk) {
    borderLine('Selected commit is not an ancestor of HEAD.');
    borderLine('Cannot safely rewrite automatically.');
    borderLine();
    abortMessage();
    return;
  }

  // Detect merges between target and HEAD (excluding target itself)
  let mergesRange = '';
  try {
    mergesRange = (await git.raw(['rev-list', '--merges', `${resolvedHash}..HEAD`])).trim();
  } catch {}

  if (mergesRange) {
    sectionTitle('Unsafe automatic rewrite');
    borderLine('Merge commits detected between target and HEAD.');
    borderLine('Falling back to manual instructions (preserving previous behavior).');
    borderLine();
    sectionTitle('Apply manually');
    borderLine(`1. git rebase -i ${resolvedHash}~1 --reword`);
    borderLine('2. Mark the line as reword if needed.');
    borderLine('3. Replace the message with:');
    borderLine();
    borderLine(candidate.title);
    if (candidate.body) candidate.body.split('\n').forEach((l) => borderLine(l || undefined));
    borderLine();
    abortMessage();
    return;
  }

  // Build a new commit object with amended message, then rebase descendants onto it
  try {
    const tree = (await git.raw(['show', '-s', '--format=%T', resolvedHash])).trim();
    const parent = commit.parents[0];
    const args = ['commit-tree', tree];
    if (parent) args.push('-p', parent);
    args.push('-m', full);
    const newHash = (await git.raw(args)).trim();

    // Rebase descendants onto newHash (range: resolvedHash..HEAD)
    await git.raw(['rebase', '--onto', newHash, resolvedHash, 'HEAD']);

    sectionTitle('Updated commit');
    borderLine(`Rewrote ${resolvedHash.slice(0, 7)} → ${newHash.slice(0, 7)}`);
    renderCommitBlock({ title: candidate.title, body: candidate.body, hideMessageLabel: true });
    borderLine();
    finalSuccess({ count: 1, startedAt });
  } catch (e: any) {
    borderLine('Automatic rewrite failed: ' + (e?.message || e));
    borderLine('If a rebase is in progress, resolve conflicts then run: git rebase --continue');
    borderLine('Or abort with: git rebase --abort');
    borderLine();
    abortMessage();
  }
}
