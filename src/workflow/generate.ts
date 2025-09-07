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

async function animateHeader() {
  const text = 'ai-conventional-commit';
  if (!process.stdout.isTTY || process.env.AICC_NO_ANIMATION) {
    console.log('\n┌  ' + chalk.bold(text));
    return;
  }
  const palette = [
    '#3a0d6d',
    '#5a1ea3',
    '#7a32d6',
    '#9a4dff',
    '#b267ff',
    '#c37dff',
    '#b267ff',
    '#9a4dff',
    '#7a32d6',
    '#5a1ea3',
  ];
  process.stdout.write('\n');
  for (const color of palette) {
    const frame = chalk.bold.hex(color)(text);
    process.stdout.write('\r┌  ' + frame);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 60));
  }
  process.stdout.write('\n');
}

export async function runGenerate(config: AppConfig) {
  if (!(await ensureStagedChanges())) {
    console.log('No staged changes.');
    return;
  }

  const files = await parseDiff();
  if (!files.length) {
    console.log('No diff content detected after staging. Aborting.');
    return;
  }

  // Panel header & staged files list
  await animateHeader();
  console.log('│');
  console.log(
    `◆  ${chalk.bold(`Detected ${files.length} staged ${files.length === 1 ? 'file' : 'files'}:`)}`,
  );
  for (const f of files) console.log('   • ' + f.file);
  console.log('│');

  const spinner = ora({ text: ' Starting', spinner: 'dots' }).start(); // leading space for alignment
  function setPhase(label: string) {
    spinner.text = ' ' + chalk.bold(label); // always keep leading space
  }
  async function runStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
    setPhase(label);
    try {
      return await fn();
    } catch (e: any) {
      spinner.fail(`◇  ${label} failed: ${e.message}`);
      throw e;
    }
  }

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

  setPhase('Result found');
  spinner.stopAndPersist({ symbol: '◆', text: ' ' + chalk.bold('Result found:') });

  candidates = candidates.map((c) => ({
    ...c,
    title: formatCommitTitle(c.title, {
      allowGitmoji: !!config.gitmoji,
      mode: (config.gitmojiMode as any) || 'standard',
    }),
  }));
  const chosen = candidates[0];

  // Immediately show commit after result (no extra separator first)
  console.log('   ' + chalk.white(chosen.title));
  if (chosen.body) {
    const indent = '   ';
    console.log(indent);
    chosen.body.split('\n').forEach((line) => {
      if (line.trim().length === 0) console.log(indent);
      else console.log(indent + chalk.white(line));
    });
  }
  console.log('│');
  const pluginErrors = await runValidations(chosen, plugins, {
    cwd: process.cwd(),
    env: process.env,
  });
  const guardErrors = checkCandidate(chosen);
  const errors = [...pluginErrors, ...guardErrors];

  // Single separator before confirmation (avoid duplicate bars)
  if (errors.length) {
    console.log(chalk.red('! Validation issues:'));
    errors.forEach((e) => console.log('  -', e));
    console.log('│');
  }
  const yn = await selectYesNo();
  if (!yn) {
    console.log('Aborted.');
    return;
  }
  await createCommit(chosen.title, chosen.body);
  saveSession({ plan, chosen, mode: 'single' });
  console.log(chalk.green('Commit created.'));
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
      message: ' Use this commit message?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: 0,
    },
  ]);
  return choice as boolean;
}
