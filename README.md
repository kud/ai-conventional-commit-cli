# ai-conventional-commit

Opinionated, style-aware AI assistant for crafting, splitting, and refining git commit messages via the local `opencode` CLI. Uses your installed `opencode` models (default `github-copilot/gpt-5`).

Formerly referenced as `aicc` in examples. The canonical command name is now `ai-conventional-commit`.

## Why

Manual commit messages are noisy, inconsistent, and often miss context. ai-conventional-commit inspects your staged diff, learns your repo's commit style, and produces Conventional Commit messages (single or split) with explanations—optionally decorated with gitmoji.

## Key Features

- Style fingerprinting (average title length, scope usage ratio, gitmoji ratio, top prefixes)
- Single (`ai-conventional-commit` / `ai-conventional-commit generate`) or multi-commit planning (`ai-conventional-commit split`)
- Refinement workflow (`ai-conventional-commit refine`) to iteratively tweak a prior result
- Gitmoji modes: `--gitmoji` (emoji + type) and `--gitmoji-pure` (emoji only)
- Reasoning depth control (`--reasoning low|medium|high`) influences explanation verbosity
- Privacy tiers governing diff detail sent to model
- Title normalization + guardrails (length, conventional schema, secret heuristic)
- Plugin system (transform + validate phases)
- Session persistence for later refinement (`.git/.aicc-cache/last-session.json`)
- Deterministic mock provider mode for tests / CI

## Install (Dev)

```bash
npm install
npm run build
npm link
# then
ai-conventional-commit --help
```

### Optional Alias (Short Name)

If you prefer the shorter historical alias, add this to your shell profile:

```bash
alias aicc='ai-conventional-commit'
```

After that you can type `aicc` instead of the full command. All subsequent examples use the full name for clarity.

## Quick Start

```bash
# Stage your changes
git add .
# Generate a single commit suggestion
ai-conventional-commit
# Multi-commit proposal (interactive confirm)
ai-conventional-commit split
# Use gitmoji with emoji+type form
ai-conventional-commit --gitmoji
# Pure gitmoji (emoji: subject)
ai-conventional-commit --gitmoji-pure
# Increase reasoning verbosity
ai-conventional-commit --reasoning=high
# Refine previous session’s first commit making it shorter
ai-conventional-commit refine --shorter
```

## Gitmoji Modes

| Mode               | Example                   | Notes                                |
| ------------------ | ------------------------- | ------------------------------------ |
| standard (default) | `feat: add search box`    | No emoji decoration                  |
| gitmoji            | `✨ feat: add search box` | Emoji + conventional type retained   |
| gitmoji-pure       | `✨: add search box`      | Type removed, emoji acts as category |

Enable via CLI flags (`--gitmoji` / `--gitmoji-pure`) or config (`gitmoji: true`, `gitmojiMode`).

## Reasoning Depth

Controls verbosity of reasons array in the JSON returned by the model:

- low: minimal
- medium: balanced
- high: detailed, more hunk-specific references

Configured with `--reasoning` or in config (`reasoning`).

## Privacy Modes

| Mode   | Data Sent to Model                                                    |
| ------ | --------------------------------------------------------------------- |
| low    | Hunk headers + first 40 changed/context lines per hunk (may truncate) |
| medium | File + hunk hash + line counts + function context only                |
| high   | File names with aggregate add/remove counts only                      |

## Configuration (.aiccrc)

Uses cosmiconfig; supports JSON, YAML, etc. Example:

```json
{
  "model": "github-copilot/gpt-5",
  "privacy": "low",
  "gitmoji": true,
  "gitmojiMode": "gitmoji",
  "reasoning": "low",
  "styleSamples": 120,
  "plugins": ["./src/sample-plugin/example-plugin.ts"],
  "maxTokens": 512
}
```

### Environment Overrides

(Note: Environment variable prefix remains `AICC_` for backward compatibility.)

- `AICC_MODEL`
- `AICC_PRIVACY`
- `AICC_STYLE_SAMPLES`
- `AICC_GITMOJI` ("true")
- `AICC_MAX_TOKENS`
- `AICC_VERBOSE`
- `AICC_MODEL_TIMEOUT_MS`
- `AICC_DEBUG` (provider debug logs)
- `AICC_PRINT_LOGS` (stream model raw output)
- `AICC_DEBUG_PROVIDER=mock` (deterministic JSON response)
- `AICC_REASONING` (low|medium|high)

## Conventional Commits Enforcement

Types: feat, fix, chore, docs, refactor, test, ci, perf, style, build, revert, merge, security, release.
Malformed titles are auto-normalized (fallback to `chore:`) before gitmoji formatting.

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

Register via `plugins` array. Transform runs once on candidate list; validate runs per chosen candidate before commit.

## Refinement Workflow

1. Generate (`ai-conventional-commit` or `ai-conventional-commit split`) – session stored.
2. Run `ai-conventional-commit refine` with flags (`--shorter`, `--longer`, `--scope=ui`, `--emoji`).
3. Accept or reject refined candidate (does not auto-amend existing git history; just updates session cache for subsequent refinement or manual use).

## Testing & Mocking

Use `AICC_DEBUG_PROVIDER=mock` to bypass model invocation and get a deterministic single commit JSON payload for faster tests / CI.

## Title Formatting Helper

All gitmoji + normalization logic centralized in `src/title-format.ts` (`formatCommitTitle`). Ensures consistent application across generate, split, and refine flows; tests in `test/title-format.test.ts`.

## Security

Lightweight heuristic secret scan on body; pair with a dedicated scanner (e.g., gitleaks) for stronger assurance.

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
- Feature-flag experimental behavior

## License

MIT
