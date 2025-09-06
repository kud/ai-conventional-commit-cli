#!/usr/bin/env node
import { Cli, Command, Option } from 'clipanion';
import { runGenerate } from './workflow/generate.js';
import { runSplit } from './workflow/split.js';
import { runRefine } from './workflow/refine.js';
import { loadConfig } from './config.js';

class GenerateCommand extends Command {
  static paths = [[`generate`], [`run`], [`commit`], []];
  gitmoji = Option.Boolean('--gitmoji', false, {
    description: 'Gitmoji mode: emoji acts as type (emoji: subject)',
  });
  gitmojiPure = Option.Boolean('--gitmoji-pure', false, {
    description: 'Pure gitmoji mode: emoji: subject (no type)',
  });

  reasoning = Option.String('--reasoning', { required: false });
  async execute() {
    const config = await loadConfig();
    if (this.gitmoji || this.gitmojiPure) {
      config.gitmoji = true;
      config.gitmojiMode = this.gitmojiPure ? 'gitmoji-pure' : 'gitmoji';
    }
    if (this.reasoning) config.reasoning = this.reasoning as any;
    await runGenerate(config);
  }
}

class SplitCommand extends Command {
  static paths = [[`split`]];
  max = Option.String('--max', { description: 'Max proposed commits', required: false });
  gitmoji = Option.Boolean('--gitmoji', false);
  gitmojiPure = Option.Boolean('--gitmoji-pure', false);
  reasoning = Option.String('--reasoning', { required: false });
  async execute() {
    const config = await loadConfig();
    if (this.gitmoji || this.gitmojiPure) {
      config.gitmoji = true;
      config.gitmojiMode = this.gitmojiPure ? 'gitmoji-pure' : 'gitmoji';
    }
    if (this.reasoning) config.reasoning = this.reasoning as any;
    await runSplit(config, this.max ? parseInt(this.max, 10) : undefined);
  }
}

class RefineCommand extends Command {
  static paths = [[`refine`]];
  shorter = Option.Boolean('--shorter', false);
  longer = Option.Boolean('--longer', false);
  scope = Option.String('--scope');
  emoji = Option.Boolean('--emoji', false);
  index = Option.String('--index');
  reasoning = Option.String('--reasoning', { required: false });
  async execute() {
    const config = await loadConfig();
    if (this.reasoning) config.reasoning = this.reasoning as any;
    await runRefine(config, {
      shorter: this.shorter,
      longer: this.longer,
      scope: this.scope,
      emoji: this.emoji,
      index: this.index ? parseInt(this.index, 10) : undefined,
    });
  }
}

const cli = new Cli({
  binaryLabel: 'ai-conventional-commit',
  binaryName: 'ai-conventional-commit',
  binaryVersion: '0.1.0',
});

cli.register(GenerateCommand);
cli.register(SplitCommand);
cli.register(RefineCommand);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
