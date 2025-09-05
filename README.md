# ai-conventional-commit-cli (command: ai-conventional-commit, alias: aicc)

AI-assisted Conventional Commit generator. Reads the staged diff, asks an AI provider CLI for a concise Conventional Commit message, enforces formatting (type/scope, subject length, wrapping), optionally lets you confirm or retry, and creates the commit (unless `--dry-run`).

Supports provider CLIs (each uses a single default model, no fallback):
- Codex CLI (`codex`) – default model: gpt-5
- Claude Code (`claude`) – default model: claude-sonnet-4-20250514
- OpenCode (`opencode`) – default provider (default model: copilot)

No Jira / ticket logic is included by design. If you need Jira later, create a sibling tool (e.g. `ai-conventional-commit-jira`).

## Install

```bash
# Inside the repo folder containing package.json & aicc.mjs
npm i -g .
```

This installs two executable names:
- `ai-conventional-commit` (primary)
- `aicc` (alias)

## Usage

```bash
aicc [options]
# or
ai-conventional-commit [options]
```

Options:
```
--provider codex|claude|opencode   (default opencode)
--model <model>                    (optional; overrides provider default model)
--type <feat|fix|refactor|chore|docs|test|perf|build|ci|style>
--scope <scope>
--max-subject <n>    (default 72)
--wrap <n>           (default 72)
--dry-run            (print message only)
--verbose            (log internal steps)
--plain              (disable fancy boxed output)
--debug              (print raw provider output + parsed segments + executed command)
--show-defaults      (print provider default model mapping and exit)
--yes / --no-confirm (auto-accept message; skip interactive prompt)
-h, --help
```

Environment variable equivalents (override defaults without flags):
```
AICC_PROVIDER, AICC_MODEL, AICC_TYPE, AICC_SCOPE,
AICC_MAX_SUBJECT, AICC_WRAP, AICC_DRY_RUN=1, AICC_VERBOSE=1, AICC_PLAIN=1, AICC_YES=1
```

## Interactive Flow
By default (TTY, not `--dry-run`, not `--yes`) you will see the proposed commit and be offered actions:
```
[y] commit  [r] retry  [c] cancel
```
- Retry regenerates with the same single default (or the explicit model you specified).
- Cancel exits with code 0 and does not create a commit.
- `--yes` / `--no-confirm` / `AICC_YES=1` skips this and auto-accepts.

## Default Models
If you do not specify `--model`, exactly one default model is used per provider (no fallback attempts):

- Codex: `gpt-5`
- Claude: `claude-sonnet-4-20250514`
- OpenCode: `copilot`

If that single model is unsupported in your local CLI version, specify another with `--model <name>` or `AICC_MODEL`. The tool will not attempt alternates automatically.

## Debug vs Verbose
`--verbose` enables zx's command echo (shows full shell commands as they run).
`--debug` adds semantic diagnostics:
- Executed provider command (with truncated prompt preview)
- Raw cleaned provider output (first and retries)
- Parsed subject and body after post-processing
- Interactive loop entry notice

Use them together for maximum transparency.

## Examples

### Fancy Output (default in TTY)
```
┌   ai-conventional-commit
│
◇  Detected 2 staged files:
     dotfiles/.gitconfig
     shell/aliases.zsh
│
◇  Using model: codex:o3
│
◇  Proposed commit message:

   chore: remove and add GH related aliases in dotfiles and zsh aliases

│  Actions: [y] commit  [r] retry  [c] cancel
│
└  ✔ Successfully committed!
```

Disable with `--plain` or `AICC_PLAIN=1`.

```bash
# Inspect defaults mapping (no generation)
aicc --show-defaults

# Default: OpenCode provider + single model (copilot)
aicc

# Claude with explicit model + scope (no fallback sequence)
ai-conventional-commit --provider claude --model claude-sonnet-4-20250514 --scope api

# OpenCode specifying model + forcing type
aicc --provider opencode --model copilot --type fix

# Preview without committing (shows final message)
aicc --dry-run --verbose

# Non-interactive auto-accept (CI script)
aicc --yes
```

## What It Does
1. Verifies you are in a Git repository and have staged changes.
2. Collects the staged diff with zero-context (`--unified=0`) to remain concise.
3. Builds a structured system + user prompt instructing the model to output ONLY a Conventional Commit.
4. Invokes selected provider CLI (single model).
5. Post-processes the returned text:
   - Strips code fences & whitespace.
   - Filters out timestamp-ish lines, CLI banners.
   - Ensures a valid `<type>(<scope>): subject` (or `<type>: subject`) structure.
   - Enforces provided `--type` / `--scope` if given.
   - Truncates subject to `--max-subject` characters and removes trailing period.
   - Wraps body paragraphs to `--wrap` columns (simple greedy algorithm).
   - Falls back to `chore:` if no allowed type detected.
6. Shows you the message and prompts for action unless auto-accepted.
7. Commits using `git commit -F -` unless `--dry-run`.

## Breaking Changes
If the model outputs a footer containing `BREAKING CHANGE:` it is preserved. The generator does not attempt to infer breaking changes itself.

## Determinism / Temperature
The script does not pass temperature or sampling args. Configure determinism inside each provider's CLI settings/profile (e.g., set low temperature there). Different providers may yield stylistic differences.

## Large Diffs
For very large diffs you may want to: 
- Add a pre-truncation guard (e.g. limit prompt size to X characters). 
- Summarize per-file changes (add/remove line counts) and feed that instead. 
Currently the script sends the entire staged diff (unified=0) which is compact for moderate changes.

## Exit Codes
- 0 success (or user-cancel)
- 1 generic error (e.g., no staged files, provider CLI missing, commit failure)

## Security / Privacy
Your staged diff content is sent to the chosen provider's model via its CLI. Ensure this complies with your data policies.

## Extending
Ideas:
- Add `--summary-only` mode to produce commit message without committing even without `--dry-run`.
- Add max diff size + summarizer.
- Add language/style presets.
- Separate Jira-aware variant (`ai-conventional-commit-jira`).

## License
MIT (adjust if needed).
