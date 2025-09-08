# ai-conventional-commit

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

> TL;DR: Stage your changes, run `ai-conventional-commit` (or `split` for multiple commits), accept, done. Add `--gitmoji` if you like emoji. Refine later with `refine`.

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

| Category           | Highlights                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| Style Intelligence | Style fingerprint (avg length, scope ratio, gitmoji usage, top prefixes) |
| Generation Modes   | Single, multi‑commit planning (`split`), iterative refinement (`refine`) |
| Commit Splitting   | Real selective staging per proposed commit (no fake plan output)         |
| Gitmoji            | Standard / emoji+type / pure emoji modes                                 |
| Guardrails         | Title normalization, Conventional syntax enforcement, length checks      |
| Privacy            | Tiered diff detail (low / medium / high)                                 |
| Plugins            | Transform & validate hooks over candidates                               |
| Determinism        | Mock provider for CI & tests (`AICC_DEBUG_PROVIDER=mock`)                |
| UX                 | Timing output, scoped prompts, animated header (optional)                |

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

# Propose multiple commits (interactive confirm + real selective staging)
ai-conventional-commit split

# Add emoji decorations
ai-conventional-commit --gitmoji

# Pure emoji style (emoji: subject)
ai-conventional-commit --gitmoji-pure

# Refine previous session's first commit (shorter wording)
ai-conventional-commit refine --shorter
```

## Command Reference

| Command                           | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `ai-conventional-commit`          | Generate single commit suggestion (default) |
| `ai-conventional-commit generate` | Explicit alias of root                      |
| `ai-conventional-commit split`    | Propose & execute multiple commits          |
| `ai-conventional-commit refine`   | Refine last session (or indexed) commit     |

Helpful flags:

- `--gitmoji` / `--gitmoji-pure`
- `--model <provider/name>` (override)
- `--scope <scope>` (refine)
- `--shorter` / `--longer`
- `--emoji` (add appropriate emoji in refine)

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

Enable via CLI flags or config (`gitmoji: true`, `gitmojiMode`).

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
  "gitmoji": true,
  "gitmojiMode": "gitmoji",
  "styleSamples": 120,
  "plugins": ["./src/sample-plugin/example-plugin.ts"],
  "maxTokens": 512
}
```

Environment overrides (prefix `AICC_`):
`MODEL`, `PRIVACY`, `STYLE_SAMPLES`, `GITMOJI`, `MAX_TOKENS`, `VERBOSE`, `MODEL_TIMEOUT_MS`, `DEBUG`, `PRINT_LOGS`, `DEBUG_PROVIDER=mock`.

## Refinement Workflow

1. Generate (`ai-conventional-commit` or `split`) – session cached under `.git/.aicc-cache/last-session.json`.
2. Run `refine` with flags (`--shorter`, `--longer`, `--scope=ui`, `--emoji`).
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
