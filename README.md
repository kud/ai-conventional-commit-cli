# ai-conventional-commit

<p align="center">
  <img src="assets/icon.png" alt="ai-conventional-commit icon" width="240" />
</p>

<p align="center">
  <b>AI‑assisted, style‑aware Conventional Commit generator & splitter</b><br/>
  Opinionated CLI that learns your repo's commit style and produces polished single or multi commits – safely, quickly, repeatably.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kud/ai-conventional-commit-cli"><img alt="npm version" src="https://img.shields.io/npm/v/%40kud%2Fai-conventional-commit-cli?color=brightgreen" /></a>
  <a href="https://www.npmjs.com/package/@kud/ai-conventional-commit-cli"><img alt="downloads" src="https://img.shields.io/npm/dm/%40kud%2Fai-conventional-commit-cli" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/npm/l/%40kud%2Fai-conventional-commit-cli" /></a>
  <a href="https://nodejs.org"><img alt="node version" src="https://img.shields.io/node/v/%40kud%2Fai-conventional-commit-cli" /></a>
  <a href="https://www.conventionalcommits.org"><img alt="Conventional Commits" src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" /></a>
</p>

> TL;DR: Stage your changes, run `ai-conventional-commit` (or `split` for multiple commits), accept, done. Add `--style gitmoji` if you like emoji. Refine later with `refine`.

<p align="center">
  🧠 &nbsp;Reads your diff &nbsp;·&nbsp;
  🎨 &nbsp;Mirrors your style &nbsp;·&nbsp;
  ✂️ &nbsp;Splits logically &nbsp;·&nbsp;
  ✅ &nbsp;One command
</p>

---

## Table of Contents

- [Why](#why)
- [Features](#features)
- [Install](#install)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [Examples](#examples)
- [Gitmoji Modes](#gitmoji-modes)
- [Privacy Modes](#privacy-modes)
- [Configuration](#configuration-aiccrc)
- [Refinement Workflow](#refinement-workflow)
- [Plugin API](#plugin-api)
- [Title Formatting Helper](#title-formatting-helper)
- [Security](#security)
- [Roadmap Ideas](#roadmap-ideas)
- [Contributing](#contributing)
- [License](#license)

## Why

Manual commit messages are often noisy, inconsistent, and context‑poor. This tool:

- Learns _your_ recent commit style (length, scopes, emoji, prefixes)
- Respects Conventional Commits & normalizes edge cases
- Proposes **multi‑commit splits** when changes are logically separable
- Lets you iteratively refine wording – without rewriting history prematurely

## Features

| Category           | Highlights                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| Style Intelligence | Style fingerprint (avg length, scope ratio, gitmoji usage, top prefixes)  |
| Generation Modes   | Single, multi‑commit planning (`split`), iterative refinement (`refine`)  |
| Commit Splitting   | Real selective staging per proposed commit (no fake plan output)          |
| Gitmoji            | Standard / emoji+type / pure emoji modes                                  |
| Guardrails         | Title normalization, Conventional syntax enforcement, length checks       |
| Privacy            | Tiered diff detail (low / medium / high)                                  |
| Plugins            | Transform & validate hooks over candidates                                |
| Determinism        | Mock provider for CI & tests (`AICC_DEBUG_PROVIDER=mock`)                 |
| UX                 | Timing output, scoped prompts, animated header (optional)                 |
| Performance        | MCP servers auto-disconnected — model focuses solely on commit generation |

## Install

Global (recommended for daily use):

```bash
npm install -g @kud/ai-conventional-commit-cli
```

Local + npx:

```bash
npm install --save-dev @kud/ai-conventional-commit-cli
npx ai-conventional-commit --help
```

From source (dev):

```bash
npm install
npm run build
npm link
ai-conventional-commit --help
```

Optional shell alias:

```bash
alias aicc='ai-conventional-commit'
```

## Quick Start

```bash
# Stage changes
git add .

# Generate a single commit suggestion
ai-conventional-commit

# Auto-confirm without prompting (useful for automation)
ai-conventional-commit --yes

# Propose multiple commits (interactive confirm + real selective staging)
ai-conventional-commit split

# Add emoji decorations (gitmoji)
ai-conventional-commit --style gitmoji

# Pure emoji style (emoji: subject)
ai-conventional-commit --style gitmoji-pure

# Refine previous session's first commit (shorter wording)
ai-conventional-commit refine --shorter

# Reword an existing commit (picker)
ai-conventional-commit reword

# Reword HEAD directly (auto-amend)
ai-conventional-commit reword HEAD
```

## Command Reference

### Reword Existing Commit

Reword (improve) the message of an existing non-merge commit without touching its diff.

```
# Interactive picker (last 20 commits)
ai-conventional-commit reword

# Reword HEAD (auto-amend)
ai-conventional-commit reword HEAD

# Reword older commit (shows interactive rebase instructions)
ai-conventional-commit reword <hash>

# With style/model overrides
ai-conventional-commit reword <hash> --style gitmoji -m github-copilot/gpt-4.1
```

Notes:

- Merge commits (multiple parents) are rejected.
- If target is HEAD and accepted, the commit is amended in-place.
- If not HEAD, printed instructions guide you through `git rebase -i --reword`.
- Title formatting (gitmoji, normalization) matches other commands.

| Command                              | Purpose                                     |
| ------------------------------------ | ------------------------------------------- |
| `ai-conventional-commit`             | Generate single commit suggestion (default) |
| `ai-conventional-commit generate`    | Explicit alias of root                      |
| `ai-conventional-commit split`       | Propose & execute multiple commits          |
| `ai-conventional-commit refine`      | Refine last session (or indexed) commit     |
| `ai-conventional-commit reword`      | AI-assisted reword of existing commit       |
| `ai-conventional-commit models`      | List / pick models, save default            |
| `ai-conventional-commit config show` | Show merged config + sources                |
| `ai-conventional-commit config get`  | Get a single config value                   |
| `ai-conventional-commit config set`  | Persist a global config value               |

Helpful flags:

- `--style <standard|gitmoji|gitmoji-pure>`
- `--model <provider/name>` (override)
- `-y, --yes` (auto-confirm without prompting)
- `--scope <scope>` (refine)
- `--shorter` / `--longer`

## Examples

### Single Commit (standard)

```
feat(api): add pagination metadata to list endpoint

Adds `total`, `limit`, `offset` fields to response; updates tests.
```

### Split Workflow (illustrative)

```
1. refactor(parser): simplify token scanning (no behavior change)
2. feat(parser): support negated glob segments
3. test(parser): add cases for brace + extglob combos
```

Each proposed commit is _actually_ staged & committed with only its files.

### Refinement

```
$ ai-conventional-commit refine --scope cli --shorter
✔ Updated: feat(cli): add split timing output
```

## Gitmoji Modes

| Mode         | Example                   | Notes                                |
| ------------ | ------------------------- | ------------------------------------ |
| standard     | `feat: add search box`    | No emoji                             |
| gitmoji      | `✨ feat: add search box` | Emoji + type retained                |
| gitmoji-pure | `✨: add search box`      | Type removed; emoji acts as category |

Enable via CLI flag `--style gitmoji|gitmoji-pure` or config `"style": "gitmoji"` / `"style": "gitmoji-pure"`.

## Privacy Modes

| Mode   | Data Sent                                              |
| ------ | ------------------------------------------------------ |
| low    | Hunk headers + first 40 changed/context lines per hunk |
| medium | File + hunk hash + line counts + function context only |
| high   | File names + aggregate add/remove counts only          |

Pick based on sensitivity; higher privacy may reduce stylistic richness.

## Configuration (.aiccrc)

Resolves via cosmiconfig (JSON/YAML/etc). Example:

```json
{
  "model": "github-copilot/gpt-4.1",
  "privacy": "low",
  "style": "gitmoji",
  "styleSamples": 120,
  "plugins": ["./src/sample-plugin/example-plugin.ts"],
  "maxTokens": 512,
  "maxFileLines": 1000,
  "skipFilePatterns": ["**/package-lock.json", "**/yarn.lock", "**/*.d.ts", "**/dist/**"]
}
```

### Configuration Options

- **`maxFileLines`** (default: 1000): Skip file content in AI prompt if diff line count exceeds this threshold (per file). Files are still committed - the AI just sees the filename and stats instead of full content. Helps avoid token overflow from extremely large files.

- **`skipFilePatterns`** (default: see below): Glob patterns for files whose content should be skipped in the AI prompt but still committed. Useful for generated files, lock files, and build artifacts.

  **Default patterns:**
  - Lock files: `**/package-lock.json`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/bun.lockb`, `**/composer.lock`, `**/Gemfile.lock`, `**/Cargo.lock`, `**/poetry.lock`
  - TypeScript declarations: `**/*.d.ts`
  - Build output: `**/dist/**`, `**/build/**`, `**/.next/**`, `**/out/**`, `**/coverage/**`
  - Minified files: `**/*.min.js`, `**/*.min.css`, `**/*.map`

  To override, provide your own array in config. To disable entirely, set to `[]`.

Environment overrides (prefix `AICC_`):

### OpenCode Provider & MCP

This tool uses the [OpenCode SDK](https://opencode.ai/docs/sdk/) to talk to models. On startup, **all MCP servers from your global OpenCode config are automatically disconnected**. This is intentional:

- Keeps the tool count well within provider limits (e.g. GitHub Copilot caps at 128 tools)
- Removes unnecessary latency from MCP initialization
- Lets the model (e.g. `gpt-4.1`) focus entirely on commit generation

Your global OpenCode MCP setup is unaffected — disconnection only applies to this tool's short-lived server process.

To verify which MCPs were disconnected, run with `AICC_DEBUG=true`.

### Configuration Precedence

Lowest to highest (later wins):

1. Built-in defaults (`github-copilot/gpt-4.1`)
2. `OPENCODE_FREE_MODEL` env var (ambient opencode default)
3. Global config file: `~/.config/ai-conventional-commit-cli/aicc.json` (or `$XDG_CONFIG_HOME`)
4. Project config (.aiccrc via cosmiconfig)
5. Environment variables (`AICC_*`)
6. CLI flags (e.g. `--model`, `--style`)

View the resolved configuration:

```bash
ai-conventional-commit config show
ai-conventional-commit config show --json | jq
```

Manage models:

```bash
ai-conventional-commit models               # list (opencode pass-through)
ai-conventional-commit models --interactive      # interactive picker
ai-conventional-commit models --interactive --save # pick + persist globally
ai-conventional-commit models --current     # show active model + source
```

`MODEL`, `PRIVACY`, `STYLE`, `STYLE_SAMPLES`, `MAX_TOKENS`, `MAX_FILE_LINES`, `VERBOSE`, `YES`, `MODEL_TIMEOUT_MS`, `DEBUG`, `PRINT_LOGS`, `DEBUG_PROVIDER=mock`. The external `OPENCODE_FREE_MODEL` env var is also honoured as a lower-priority model default (before `AICC_MODEL`).

**Note:** `skipFilePatterns` cannot be set via environment variable - use config file or accept defaults.

## Refinement Workflow

1. Generate (`ai-conventional-commit` or `split`) – session cached under `.git/.aicc-cache/last-session.json`.
2. Run `refine` with flags (`--shorter`, `--longer`, `--scope=ui`).
3. Accept or reject; refined output does _not_ auto‑amend history until you use it.

## Plugin API

```ts
interface PluginContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}
interface Plugin {
  name: string;
  transformCandidates?(
    candidates: CommitCandidate[],
    ctx: PluginContext,
  ): CommitCandidate[] | Promise<CommitCandidate[]>;
  validateCandidate?(
    candidate: CommitCandidate,
    ctx: PluginContext,
  ): string | string[] | void | Promise<string | string[] | void>;
}
```

Register via `plugins` array. `transform` runs once over the candidate list; `validate` runs per chosen candidate before commit.

### Example Plugin (lightweight scope normalizer)

```ts
export default {
  name: 'scope-normalizer',
  transformCandidates(cands) {
    return cands.map((c) => ({
      ...c,
      title: c.title.replace('(UI)', '(ui)'),
    }));
  },
};
```

## Title Formatting Helper

All gitmoji + normalization logic: `src/title-format.ts` (`formatCommitTitle`). Tested in `test/title-format.test.ts`.

## Security

Lightweight heuristic secret scan of commit body (add/removed lines) – not a substitute for dedicated scanners (e.g. gitleaks). Pair with your existing pipelines.

## Roadmap Ideas

- Embedding-based semantic clustering
- Local model (Ollama) fallback
- Streaming / partial UI updates
- Commit plan editing (accept subset, re-cluster)
- Scope inference heuristics
- Extended secret scanning

## Contributing

PRs welcome. Please:

- Keep dependencies minimal
- Add tests for new formatting or parsing logic
- Feature‑flag experimental behavior

## License

MIT
