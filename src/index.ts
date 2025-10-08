#!/usr/bin/env node
import { Cli, Command, Option } from 'clipanion';
import { runGenerate } from './workflow/generate.js';
import { runSplit } from './workflow/split.js';
import { runRefine } from './workflow/refine.js';
import { loadConfig } from './config.js';
import pkgJson from '../package.json' with { type: 'json' };
import { execa } from 'execa';
import inquirer from 'inquirer';

const pkgVersion = pkgJson.version || '0.0.0';

// Root command (default). Mirrors generate behaviour but shows aggregated help.
class RootCommand extends Command {
  static paths = [[]];
  static usage = Command.Usage({
    description: 'Generate a conventional commit message (default command).',
    details: `Commands:\n\n⋅ generate: Generate a single commit (default)\n\n⋅ split: Plan & apply multiple smaller commits\n\n⋅ refine: Refine last (or indexed) commit\n\n⋅ models: List or pick AI models (opencode)\n\n⋅ config show: Show merged config + sources\n\n⋅ config get <key>: Get a single config value\n\n⋅ config set <k> <v>: Persist a global config value\n\nRefine Options:\n\n⋅ --shorter: Make message more concise\n\n⋅ --longer: Expand message with detail\n\n⋅ --scope <scope>: Add or replace scope\n\n⋅ --index <n>: Target commit from previous split`,
    examples: [
      ['Generate with gitmoji style', 'ai-conventional-commit --style gitmoji'],
      ['Split staged changes', 'ai-conventional-commit split --max 3'],

      ['Pick & save default model', 'ai-conventional-commit models -i --save'],
      ['Set style globally', 'ai-conventional-commit config set style gitmoji'],
      ['Show config JSON', 'ai-conventional-commit config show --json'],
    ],
  });

  style = Option.String('--style', {
    required: false,
    description: 'Title style: standard | gitmoji | gitmoji-pure',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name (e.g. github-copilot/gpt-4.1)',
  });

  async execute() {
    const config = await loadConfig();
    if (this.style) config.style = this.style as any;
    if (this.model) config.model = this.model;
    await runGenerate(config);
  }
}

class GenerateCommand extends Command {
  static paths = [[`generate`]];
  static usage = Command.Usage({
    description: 'Generate a conventional commit message for staged changes.',
    details: `Generate a single conventional commit using AI with style rules, guardrails, and optional model override. Uses staged changes. Add --style gitmoji or --style gitmoji-pure for emoji modes.`,
    examples: [
      ['Basic usage (standard style)', 'ai-conventional-commit generate'],
      ['Force gitmoji style', 'ai-conventional-commit generate --style gitmoji'],
      [
        'Override model for this run',
        'ai-conventional-commit generate --model github-copilot/gpt-4.1',
      ],
    ],
  });

  style = Option.String('--style', {
    required: false,
    description: 'Title style: standard | gitmoji | gitmoji-pure',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name (e.g. github-copilot/gpt-4.1)',
  });
  async execute() {
    const config = await loadConfig();
    if (this.style) {
      config.style = this.style as any;
    }

    if (this.model) config.model = this.model;
    await runGenerate(config);
  }
}

class SplitCommand extends Command {
  static paths = [[`split`]];
  static usage = Command.Usage({
    description: 'Propose multiple smaller conventional commits for current staged diff.',
    details: `Analyze staged changes, group them logically, and propose multiple conventional commit titles + bodies. Use --max to limit proposals. Each proposal obeys style + guardrails.`,
    examples: [
      ['Default split (standard style)', 'ai-conventional-commit split'],
      [
        'Limit to 3 proposals with gitmoji style',
        'ai-conventional-commit split --max 3 --style gitmoji',
      ],
    ],
  });
  max = Option.String('--max', { description: 'Max proposed commits', required: false });
  style = Option.String('--style', {
    required: false,
    description: 'Title style: standard | gitmoji | gitmoji-pure',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name override',
  });
  async execute() {
    const config = await loadConfig();
    if (this.style) config.style = this.style as any;

    if (this.model) config.model = this.model;
    await runSplit(config, this.max ? parseInt(this.max, 10) : undefined);
  }
}

class RefineCommand extends Command {
  static paths = [[`refine`]];
  static usage = Command.Usage({
    description: 'Refine the last (or chosen) commit message with style rules.',
    details: `Targeted improvements to an existing commit: shorter/longer length, inject or replace scope, or refine a specific index from a previous split.`,
    examples: [
      ['Shorten the last commit message', 'ai-conventional-commit refine --shorter'],
      ['Add a scope to the last commit', 'ai-conventional-commit refine --scope ui'],
    ],
  });
  shorter = Option.Boolean('--shorter', false, { description: 'Make message more concise' });
  longer = Option.Boolean('--longer', false, { description: 'Expand message with detail' });
  scope = Option.String('--scope', { description: 'Override/add scope (e.g. ui, api)' });

  style = Option.String('--style', {
    required: false,
    description: 'Title style: standard | gitmoji | gitmoji-pure',
  });
  index = Option.String('--index', {
    description: 'Select commit index if multiple were generated',
  });

  model = Option.String('-m,--model', {
    required: false,
    description: 'Model provider/name override',
  });
  async execute() {
    const config = await loadConfig();

    if (this.style) config.style = this.style as any;
    if (this.model) config.model = this.model;
    await runRefine(config, {
      shorter: this.shorter,
      longer: this.longer,
      scope: this.scope,

      index: this.index ? parseInt(this.index, 10) : undefined,
    });
  }
}

class ModelsCommand extends Command {
  static paths = [[`models`]];
  static usage = Command.Usage({
    description: 'List available models via opencode CLI.',
    details: `Wrapper around "opencode models". Use --interactive (or -i) for a picker; prints the selected model id for piping or quick copy. Add --save with --interactive to persist globally in aicc.json (XDG config).`,
    examples: [
      ['List models', 'ai-conventional-commit models'],
      ['Interactively pick a model', 'ai-conventional-commit models --interactive'],
      ['Pick & save globally', 'ai-conventional-commit models --interactive --save'],
    ],
  });
  interactive = Option.Boolean('-i,--interactive', false, {
    description: 'Interactive model selection',
  });

  save = Option.Boolean('--save', false, {
    description: 'Persist selected model globally (requires --interactive)',
  });
  current = Option.Boolean('--current', false, {
    description: 'Print current default model and its source',
  });
  async execute() {
    if (this.current) {
      const { loadConfigDetailed } = await import('./config.js');
      const { config } = await loadConfigDetailed();
      this.context.stdout.write(`${config.model} (source: ${config._sources.model})` + '\n');
      return;
    }
    try {
      const { stdout } = await execa('opencode', ['models']).catch(async (err) => {
        if (err.shortMessage && /ENOENT/.test(err.shortMessage)) {
          this.context.stderr.write(
            'opencode CLI not found in PATH. Install it from https://github.com/opencodejs/opencode or ensure the binary is available.\n',
          );
        }
        throw err;
      });
      const useInteractive = this.interactive;
      if (!useInteractive) {
        this.context.stdout.write(stdout.trim() + '\n');
        return;
      }
      if (!process.stdout.isTTY) {
        this.context.stdout.write(stdout.trim() + '\n');
        return;
      }
      // Extract candidate model identifiers of the form provider/model
      const candidates = Array.from(
        new Set(
          stdout
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => /^[a-z0-9_.-]+\/[A-Za-z0-9_.:-]+$/.test(l)),
        ),
      );
      if (candidates.length === 0) {
        this.context.stdout.write(stdout.trim() + '\n');
        return;
      }
      const { model } = await inquirer.prompt<{
        model: string;
      }>([
        {
          name: 'model',
          type: 'list',
          message: 'Select a model',
          choices: candidates,
        },
      ]);
      this.context.stdout.write(model + '\n');
      if (this.save) {
        try {
          const { saveGlobalConfig } = await import('./config.js');
          const path = saveGlobalConfig({ model });
          this.context.stdout.write(`Saved as default model in ${path}\n`);
        } catch (e: any) {
          this.context.stderr.write(`Failed to save global config: ${e?.message || e}\n`);
        }
      }
      this.context.stdout.write(
        `\nUse it now:\n  ai-conventional-commit generate --model ${model}\n`,
      );
    } catch (e: any) {
      this.context.stderr.write(
        `Failed to list models via \"opencode models\": ${e?.message || e}\n`,
      );
    }
  }
}

class ConfigShowCommand extends Command {
  static paths = [[`config`, `show`]];
  static usage = Command.Usage({
    description: 'Show effective configuration with source metadata.',
    details:
      'Outputs merged config fields, their values, and source precedence info. Use --json for raw JSON including _sources.',
    examples: [
      ['Human readable', 'ai-conventional-commit config show'],
      ['JSON with sources', 'ai-conventional-commit config show --json'],
    ],
  });
  json = Option.Boolean('--json', false, { description: 'Output JSON including _sources' });
  async execute() {
    const { loadConfigDetailed } = await import('./config.js');
    const { config, raw } = await loadConfigDetailed();
    if (this.json) {
      this.context.stdout.write(JSON.stringify({ config, raw }, null, 2) + '\n');
      return;
    }
    const sources: any = (config as any)._sources;
    const lines = Object.entries(config)
      .filter(([k]) => k !== '_sources')
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}  (${sources[k]})`);
    this.context.stdout.write(lines.join('\n') + '\n');
  }
}

class ConfigGetCommand extends Command {
  static paths = [[`config`, `get`]];
  static usage = Command.Usage({
    description: 'Get a single configuration value (effective).',
    details: 'Returns the effective value after merging sources. Optionally show its source.',
    examples: [
      ['Get model', 'ai-conventional-commit config get model'],
      ['Get style', 'ai-conventional-commit config get style'],
      ['Get model with source', 'ai-conventional-commit config get model --with-source'],
    ],
  });
  key = Option.String();
  withSource = Option.Boolean('--with-source', false, { description: 'Append source label' });
  async execute() {
    const { loadConfigDetailed } = await import('./config.js');
    const { config } = await loadConfigDetailed();
    const key = this.key as keyof typeof config;
    if (!(key in config)) {
      this.context.stderr.write(`Unknown config key: ${this.key}\n`);
      process.exitCode = 1;
      return;
    }
    if (this.withSource) {
      const src = (config as any)._sources?.[key];
      this.context.stdout.write(`${JSON.stringify((config as any)[key])} (${src})\n`);
    } else {
      this.context.stdout.write(JSON.stringify((config as any)[key]) + '\n');
    }
  }
}

class ConfigSetCommand extends Command {
  static paths = [[`config`, `set`]];
  static usage = Command.Usage({
    description: 'Set and persist a global configuration key.',
    details:
      'Writes to the global aicc.json (XDG config). Accepts JSON for complex values. Only allowed keys: model, style, privacy, styleSamples, maxTokens, verbose.',
    examples: [
      ['Set default model', 'ai-conventional-commit config set model github-copilot/gpt-4.1'],
      ['Set style to gitmoji', 'ai-conventional-commit config set style gitmoji'],
      ['Enable verbose mode', 'ai-conventional-commit config set verbose true'],
    ],
  });
  key = Option.String();
  value = Option.String();
  async execute() {
    const allowed = new Set(['model', 'style', 'privacy', 'styleSamples', 'maxTokens', 'verbose']);
    if (!allowed.has(this.key)) {
      this.context.stderr.write(`Cannot set key: ${this.key}\n`);
      process.exitCode = 1;
      return;
    }
    let parsed: any = this.value;
    if (/^(true|false)$/i.test(this.value)) parsed = this.value.toLowerCase() === 'true';
    else if (/^[0-9]+$/.test(this.value)) parsed = parseInt(this.value, 10);
    else if (/^[\[{]/.test(this.value)) {
      try {
        parsed = JSON.parse(this.value);
      } catch {
        /* keep as string */
      }
    }
    const { saveGlobalConfig } = await import('./config.js');
    const path = saveGlobalConfig({ [this.key]: parsed } as any);
    this.context.stdout.write(`Saved ${this.key} to ${path}\n`);
  }
}

class RewordCommand extends Command {
  static paths = [[`reword`]];
  static usage = Command.Usage({
    description: 'AI-assisted reword of an existing commit (by hash).',
    details:
      'Generate an improved Conventional Commit message for the given commit hash. If the hash is HEAD the commit is amended; otherwise rebase instructions are shown. If no hash is provided, an interactive picker of recent commits appears.',
    examples: [
      ['Interactive pick', 'ai-conventional-commit reword'],
      ['Reword HEAD', 'ai-conventional-commit reword HEAD'],
      ['Reword older commit', 'ai-conventional-commit reword d30fd1b'],
    ],
  });
  hash = Option.String({ required: false });
  async execute() {
    const { runReword } = await import('./workflow/reword.js');
    const config = await loadConfig();
    let target = this.hash;
    if (!target) {
      try {
        const { simpleGit } = await import('simple-git');
        const git = simpleGit();
        const log = await git.log({ maxCount: 20 });
        if (!log.all.length) {
          this.context.stderr.write('No commits available to select.\n');
          return;
        }
        const choices = log.all.map((c) => ({
          name: `${c.hash.slice(0, 7)} ${c.message.split('\n')[0]}`.slice(0, 80),
          value: c.hash,
        }));
        choices.push({ name: 'Cancel', value: '__CANCEL__' });
        const { picked } = await inquirer.prompt([
          {
            type: 'list',
            name: 'picked',
            message: 'Select a commit to reword',
            choices,
            pageSize: Math.min(choices.length, 15),
          },
        ]);
        if (picked === '__CANCEL__') {
          this.context.stdout.write('Aborted.\n');
          return;
        }
        target = picked;
      } catch (e: any) {
        this.context.stderr.write('Failed to list commits: ' + (e?.message || e) + '\n');
        return;
      }
    }
    await runReword(config, target!);
  }
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

cli.register(RootCommand);
cli.register(GenerateCommand);
cli.register(SplitCommand);
cli.register(RefineCommand);
cli.register(ModelsCommand);
cli.register(ConfigShowCommand);
cli.register(ConfigGetCommand);
cli.register(ConfigSetCommand);
cli.register(RewordCommand);
cli.register(VersionCommand);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
