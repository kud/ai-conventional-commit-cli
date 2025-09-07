#!/usr/bin/env node
import { Cli, Command, Option } from 'clipanion';
import { runGenerate } from './workflow/generate.js';
import { runSplit } from './workflow/split.js';
import { runRefine } from './workflow/refine.js';
import { loadConfig } from './config.js';
import pkgJson from '../package.json' with { type: 'json' };

const pkgVersion = pkgJson.version || '0.0.0';

class GenerateCommand extends Command {
  static paths = [[`generate`], []];
  static usage = Command.Usage({
    description: 'Generate a conventional commit message for staged changes.',
    details: `Generates a single commit message using AI with style + guardrails.\nAdd --gitmoji[-pure] to enable emoji styles.`,
    examples: [
      ['Generate a commit with gitmoji style', 'ai-conventional-commit generate --gitmoji'],
    ],
  });

  gitmoji = Option.Boolean('--gitmoji', false, {
    description: 'Gitmoji mode (vs --gitmoji-pure): emoji + type (emoji: subject)',
  });
  gitmojiPure = Option.Boolean('--gitmoji-pure', false, {
    description: 'Pure gitmoji mode (vs --gitmoji): emoji only (emoji: subject)',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name (e.g. github-copilot/gpt-5)',
  });
  async execute() {
    const config = await loadConfig();
    if (this.gitmoji || this.gitmojiPure) {
      config.gitmoji = true;
      config.gitmojiMode = this.gitmojiPure ? 'gitmoji-pure' : 'gitmoji';
    }

    if (this.model) config.model = this.model;
    await runGenerate(config);
  }
}

class SplitCommand extends Command {
  static paths = [[`split`]];
  static usage = Command.Usage({
    description: 'Propose multiple smaller conventional commits for current staged diff.',
    details: `Analyzes staged changes, groups them logically and suggests multiple commit messages.\nUse --max to limit the number of proposals.`,
    examples: [
      [
        'Split into at most 3 commits with gitmoji',
        'ai-conventional-commit split --max 3 --gitmoji',
      ],
    ],
  });
  max = Option.String('--max', { description: 'Max proposed commits', required: false });
  gitmoji = Option.Boolean('--gitmoji', false, {
    description: 'Gitmoji mode (vs --gitmoji-pure): emoji + type',
  });
  gitmojiPure = Option.Boolean('--gitmoji-pure', false, {
    description: 'Pure gitmoji mode (vs --gitmoji): emoji only',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name override',
  });
  async execute() {
    const config = await loadConfig();
    if (this.gitmoji || this.gitmojiPure) {
      config.gitmoji = true;
      config.gitmojiMode = this.gitmojiPure ? 'gitmoji-pure' : 'gitmoji';
    }

    if (this.model) config.model = this.model;
    await runSplit(config, this.max ? parseInt(this.max, 10) : undefined);
  }
}

class RefineCommand extends Command {
  static paths = [[`refine`]];
  static usage = Command.Usage({
    description: 'Refine the last (or chosen) commit message with style rules.',
    details: `Allows targeted improvements: shorter/longer length, inject scope, add emoji, or select a specific index when multiple commits were generated earlier.`,
    examples: [
      ['Shorten the last commit message', 'ai-conventional-commit refine --shorter'],
      ['Add a scope to the last commit', 'ai-conventional-commit refine --scope ui'],
    ],
  });
  shorter = Option.Boolean('--shorter', false, { description: 'Make message more concise' });
  longer = Option.Boolean('--longer', false, { description: 'Expand message with detail' });
  scope = Option.String('--scope', { description: 'Override/add scope (e.g. ui, api)' });
  emoji = Option.Boolean('--emoji', false, { description: 'Add appropriate gitmoji (non-pure)' });
  index = Option.String('--index', {
    description: 'Select commit index if multiple were generated',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name override',
  });
  async execute() {
    const config = await loadConfig();

    if (this.model) config.model = this.model;
    await runRefine(config, {
      shorter: this.shorter,
      longer: this.longer,
      scope: this.scope,
      emoji: this.emoji,
      index: this.index ? parseInt(this.index, 10) : undefined,
    });
  }
}

// Custom help command to list commands when no subcommand provided with --help
class HelpCommand extends Command {
  static paths = [[`--help`], [`-h`]]; // capture explicit help
  async execute() {
    this.context.stdout.write(globalHelp() + '\n');
  }
}

function globalHelp() {
  return `ai-conventional-commit v${pkgVersion}\n\nUsage:\n  ai-conventional-commit [generate] [options]   Generate a commit (default)\n  ai-conventional-commit split [options]        Propose multiple commits\n  ai-conventional-commit refine [options]       Refine last or indexed commit\n\nGlobal Options:\n  -m, --model <provider/name>   Override model provider/name\n  --gitmoji[-pure]              Gitmoji modes: emoji + type (default) or pure emoji only\n  -h, --help                    Show this help\n  -V, --version                 Show version\n\nRefine Options:\n  --shorter / --longer          Adjust message length\n  --scope <scope>               Add or replace scope\n  --emoji                       Add suitable gitmoji\n  --index <n>                   Select commit index\n\nExamples:\n  ai-conventional-commit --gitmoji\n  ai-conventional-commit --gitmoji-pure\n  ai-conventional-commit split --max 3 --gitmoji\n  ai-conventional-commit refine --scope api --emoji\n`;
}

class VersionCommand extends Command {
  static paths = [[`--version`], [`-V`]];
  async execute() {
    this.context.stdout.write(`${pkgVersion}\n`);
  }
}

const cli = new Cli({
  binaryLabel: 'ai-conventional-commit',
  binaryName: 'ai-conventional-commit',
  binaryVersion: pkgVersion,
});

cli.register(GenerateCommand);
cli.register(SplitCommand);
cli.register(RefineCommand);
cli.register(HelpCommand);
cli.register(VersionCommand);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
