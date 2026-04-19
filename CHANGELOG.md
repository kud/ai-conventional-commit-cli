# Changelog

All notable changes to this project are documented here.

---

## [3.5.0] — 2026-04-19

### ✨ Features

- Add ClaudeCliProvider and provider factory ([#bd22d1f](https://github.com/kud/ai-conventional-commit-cli/commit/bd22d1f))

---

## [3.4.0] — 2026-04-18

### ✨ Features

- Add truncateMiddle and tests for mid-string truncation ([#4b39e39](https://github.com/kud/ai-conventional-commit-cli/commit/4b39e39))

<details>
<summary>🔧 Internal changes (2 commits)</summary>

- test(truncate-middle): refine fixture path tail case ([#90a1272](https://github.com/kud/ai-conventional-commit-cli/commit/90a1272))
- 🏗️ build(pages): add version injection to docs and release trigger ([#d7817b1](https://github.com/kud/ai-conventional-commit-cli/commit/d7817b1))

</details>

---

## [v3.3.2] — 2026-04-12

### ✨ Features

- Add retry logic for transient errors ([#e9c05a9](https://github.com/kud/ai-conventional-commit-cli/commit/e9c05a9))
- Add picker for model timeout recovery ([#a713940](https://github.com/kud/ai-conventional-commit-cli/commit/a713940))
- Add robust killWithFallback for server shutdown ([#ee37ab1](https://github.com/kud/ai-conventional-commit-cli/commit/ee37ab1))
- Gracefully close server on process exit ([#e6d4588](https://github.com/kud/ai-conventional-commit-cli/commit/e6d4588))
- Expand skipFilePatterns defaults ([#023a82e](https://github.com/kud/ai-conventional-commit-cli/commit/023a82e))
- Parallelise git diff and style profile ([#763dcc8](https://github.com/kud/ai-conventional-commit-cli/commit/763dcc8))
- Add debug logs for MCP disconnect ([#67e2555](https://github.com/kud/ai-conventional-commit-cli/commit/67e2555))
- Expand .env.example and update model provider logic ([#c124d4e](https://github.com/kud/ai-conventional-commit-cli/commit/c124d4e))
- Replace inquirer with @inquirer/prompts select ([#bf761d1](https://github.com/kud/ai-conventional-commit-cli/commit/bf761d1))
- Update dependencies and provider logic ([#9ef52bd](https://github.com/kud/ai-conventional-commit-cli/commit/9ef52bd))
- Add provider re-export file ([#6603270](https://github.com/kud/ai-conventional-commit-cli/commit/6603270))
- Reuse running opencode server if available ([#ad46c3c](https://github.com/kud/ai-conventional-commit-cli/commit/ad46c3c))
- Migrate to opencode SDK provider ([#14865e6](https://github.com/kud/ai-conventional-commit-cli/commit/14865e6))
- Switch to @opencode-ai/sdk for OpenCodeProvider ([#9542714](https://github.com/kud/ai-conventional-commit-cli/commit/9542714))
- Support OPENCODE_FREE_MODEL as default ([#f5ffa8f](https://github.com/kud/ai-conventional-commit-cli/commit/f5ffa8f))
- Document --yes flag for auto-confirm ([#23b4a6b](https://github.com/kud/ai-conventional-commit-cli/commit/23b4a6b))
- Add @inquirer/prompts for improved selection ([#0e0c61a](https://github.com/kud/ai-conventional-commit-cli/commit/0e0c61a))
- Replace confirm with list for yes/no prompts ([#5efee79](https://github.com/kud/ai-conventional-commit-cli/commit/5efee79))
- Simplify yes/no prompt to confirm ([#6324a64](https://github.com/kud/ai-conventional-commit-cli/commit/6324a64))
- Improve diff summary for deleted files ([#033e9c7](https://github.com/kud/ai-conventional-commit-cli/commit/033e9c7))
- Handle renamed files in staged status ([#9d55ed0](https://github.com/kud/ai-conventional-commit-cli/commit/9d55ed0))
- Handle renamed files in diff parsing ([#e7c7328](https://github.com/kud/ai-conventional-commit-cli/commit/e7c7328))
- Handle zero-diff files in summary bar ([#f0bf4e5](https://github.com/kud/ai-conventional-commit-cli/commit/f0bf4e5))
- Improve commit reword output formatting ([#b6166da](https://github.com/kud/ai-conventional-commit-cli/commit/b6166da))
- Load package version at runtime ([#b178594](https://github.com/kud/ai-conventional-commit-cli/commit/b178594))
- Add style and model override options to RewordCommand ([#67de645](https://github.com/kud/ai-conventional-commit-cli/commit/67de645))
- Add reword command for AI-assisted commit message updates ([#966ba8b](https://github.com/kud/ai-conventional-commit-cli/commit/966ba8b))
- Enforce required scope in title format ([#c1d0a0c](https://github.com/kud/ai-conventional-commit-cli/commit/c1d0a0c))
- Add diffstat bar chart to file summary ([#9942b54](https://github.com/kud/ai-conventional-commit-cli/commit/9942b54))
- Handle staged files with no diff output ([#f5ae952](https://github.com/kud/ai-conventional-commit-cli/commit/f5ae952))
- Improve commit block description formatting ([#13f7281](https://github.com/kud/ai-conventional-commit-cli/commit/13f7281))
- Update default model to github-copilot/gpt-4.1 ([#ef10bc7](https://github.com/kud/ai-conventional-commit-cli/commit/ef10bc7))
- Display model name in animated header ([#a861378](https://github.com/kud/ai-conventional-commit-cli/commit/a861378))
- Add help/version commands, files field, new UI; remove reasoning ([#aa07e2e](https://github.com/kud/ai-conventional-commit-cli/commit/aa07e2e))
- Add animated header and improve generate CLI output ([#3f9ca7f](https://github.com/kud/ai-conventional-commit-cli/commit/3f9ca7f))
- TypeScript CLI with plugin system and split/refine workflows ([#ab8ca1e](https://github.com/kud/ai-conventional-commit-cli/commit/ab8ca1e))

### 🐛 Bug Fixes

- Ensure server process group killed reliably ([#da1cc3a](https://github.com/kud/ai-conventional-commit-cli/commit/da1cc3a))
- Ensure tidy kill of server process on close ([#6b7062d](https://github.com/kud/ai-conventional-commit-cli/commit/6b7062d))
- Ensure opencode server closes on exit ([#3d39a4f](https://github.com/kud/ai-conventional-commit-cli/commit/3d39a4f))
- Abort process and close server cleanly ([#9c760bb](https://github.com/kud/ai-conventional-commit-cli/commit/9c760bb))
- Prevent context overflow on large diffs ([#1da34df](https://github.com/kud/ai-conventional-commit-cli/commit/1da34df))
- Reattach branch after rebase if detached ([#e9ed56b](https://github.com/kud/ai-conventional-commit-cli/commit/e9ed56b))
- Prevent detached HEAD after reword rebase ([#5c19afd](https://github.com/kud/ai-conventional-commit-cli/commit/5c19afd))
- Update default model timeout to 120000ms ([#50b3081](https://github.com/kud/ai-conventional-commit-cli/commit/50b3081))

### ♻️ Refactoring

- Extract code generation logic ([#ab9c145](https://github.com/kud/ai-conventional-commit-cli/commit/ab9c145))
- Improve error handling for commit workflow ([#a33928d](https://github.com/kud/ai-conventional-commit-cli/commit/a33928d))
- Launch OpenCode server via child process ([#9fbd432](https://github.com/kud/ai-conventional-commit-cli/commit/9fbd432))
- Streamline file summary line construction ([#7fc5de4](https://github.com/kud/ai-conventional-commit-cli/commit/7fc5de4))
- Remove zero-change file borderLine output ([#9f5d9f2](https://github.com/kud/ai-conventional-commit-cli/commit/9f5d9f2))
- Remove programmatic title length enforcement ([#761924e](https://github.com/kud/ai-conventional-commit-cli/commit/761924e))

### 📝 Documentation

- Update smoke test for MAX_DIFF_CHARS budget ([#3edef75](https://github.com/kud/ai-conventional-commit-cli/commit/3edef75))
- Document OpenCode MCP disconnection behaviour ([#cd977c7](https://github.com/kud/ai-conventional-commit-cli/commit/cd977c7))
- Document maxFileLines and skipFilePatterns ([#f941438](https://github.com/kud/ai-conventional-commit-cli/commit/f941438))
- Clarify reword command usage examples ([#0e5112f](https://github.com/kud/ai-conventional-commit-cli/commit/0e5112f))
- Add reword command usage and details ([#a4058c9](https://github.com/kud/ai-conventional-commit-cli/commit/a4058c9))
- Update CLI flags and config instructions for style option ([#268d0fc](https://github.com/kud/ai-conventional-commit-cli/commit/268d0fc))
- Enrich README with badges, TOC, plugin example & workflow ([#01257df](https://github.com/kud/ai-conventional-commit-cli/commit/01257df))
- Update README for ai-conventional-commit rename and alias ([#71581c5](https://github.com/kud/ai-conventional-commit-cli/commit/71581c5))

### 📦 Other

- Bump version to 0.7.0 ([#a965dae](https://github.com/kud/ai-conventional-commit-cli/commit/a965dae))
- Add trailing blank line after final success/abort messages ([#241197b](https://github.com/kud/ai-conventional-commit-cli/commit/241197b))

<details>
<summary>🔧 Internal changes (14 commits)</summary>

- 🧹 chore(package): update homepage URL ([#e6a1f29](https://github.com/kud/ai-conventional-commit-cli/commit/e6a1f29))
- 🤖 ci(pages): add GitHub Pages deploy workflow and docs ([#3569cfc](https://github.com/kud/ai-conventional-commit-cli/commit/3569cfc))
- 🤖 ci(github-actions): add release pipeline for tag publishing ([#1dd8d46](https://github.com/kud/ai-conventional-commit-cli/commit/1dd8d46))
- chore(debug): add structured debug logging utilities ([#6fcd8a0](https://github.com/kud/ai-conventional-commit-cli/commit/6fcd8a0))
- 🎨 style(index): improve formatting and exit handling ([#3d00df6](https://github.com/kud/ai-conventional-commit-cli/commit/3d00df6))
- 🧹 chore: feat/git: indicate deleted files in diff summary ([#5c5eb77](https://github.com/kud/ai-conventional-commit-cli/commit/5c5eb77))
- 🧹 chore: update minimum Node.js version to 20.0.0 ([#a647202](https://github.com/kud/ai-conventional-commit-cli/commit/a647202))
- 🧹 chore: bump zod dependency to 4.1.8 ([#d121375](https://github.com/kud/ai-conventional-commit-cli/commit/d121375))
- 🧹 chore: update dependencies for inquirer, chalk, keyv, strip-ansi, zod ([#0787184](https://github.com/kud/ai-conventional-commit-cli/commit/0787184))
- 🏗️ build: remove deprecated aicc CLI alias ([#9a11f94](https://github.com/kud/ai-conventional-commit-cli/commit/9a11f94))
- 🧹 chore: add repository, bugs and homepage fields to package.json ([#530aad4](https://github.com/kud/ai-conventional-commit-cli/commit/530aad4))
- 🧹 chore: remove legacy aicc alias references and align binary/log namin ([#9773929](https://github.com/kud/ai-conventional-commit-cli/commit/9773929))
- 📦 build: add prepublish script, restrict files, drop aicc binary ([#6477e45](https://github.com/kud/ai-conventional-commit-cli/commit/6477e45))
- 🧪 test: add coverage for diff parsing, normalization, prompt messages ([#92779af](https://github.com/kud/ai-conventional-commit-cli/commit/92779af))

</details>

---

## [v3.3.1] — 2026-04-12

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore(package): update homepage URL ([#e6a1f29](https://github.com/kud/ai-conventional-commit-cli/commit/e6a1f29))

</details>

---

## [v3.3.0] — 2026-04-06

### ✨ Features

- Add retry logic for transient errors ([#e9c05a9](https://github.com/kud/ai-conventional-commit-cli/commit/e9c05a9))

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🤖 ci(pages): add GitHub Pages deploy workflow and docs ([#3569cfc](https://github.com/kud/ai-conventional-commit-cli/commit/3569cfc))

</details>

---

## [v3.2.9] — 2026-04-04

### ✨ Features

- Add picker for model timeout recovery ([#a713940](https://github.com/kud/ai-conventional-commit-cli/commit/a713940))

---

## [v3.2.8] — 2026-04-03

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🤖 ci(github-actions): add release pipeline for tag publishing ([#1dd8d46](https://github.com/kud/ai-conventional-commit-cli/commit/1dd8d46))

</details>

---

## [v3.2.7] — 2026-04-03

### 🐛 Bug Fixes

- Ensure server process group killed reliably ([#da1cc3a](https://github.com/kud/ai-conventional-commit-cli/commit/da1cc3a))

### 📝 Documentation

- Update smoke test for MAX_DIFF_CHARS budget ([#3edef75](https://github.com/kud/ai-conventional-commit-cli/commit/3edef75))

---

## [v3.2.6] — 2026-04-03

### 🐛 Bug Fixes

- Ensure tidy kill of server process on close ([#6b7062d](https://github.com/kud/ai-conventional-commit-cli/commit/6b7062d))

---

## [v3.2.5] — 2026-04-02

### ✨ Features

- Add robust killWithFallback for server shutdown ([#ee37ab1](https://github.com/kud/ai-conventional-commit-cli/commit/ee37ab1))

---

## [v3.2.4] — 2026-04-02

### ♻️ Refactoring

- Extract code generation logic ([#ab9c145](https://github.com/kud/ai-conventional-commit-cli/commit/ab9c145))

---

## [v3.2.3] — 2026-04-01

### ♻️ Refactoring

- Improve error handling for commit workflow ([#a33928d](https://github.com/kud/ai-conventional-commit-cli/commit/a33928d))

---

## [v3.2.2] — 2026-04-01

### ♻️ Refactoring

- Launch OpenCode server via child process ([#9fbd432](https://github.com/kud/ai-conventional-commit-cli/commit/9fbd432))

---

## [v3.2.1] — 2026-03-31

### 🐛 Bug Fixes

- Ensure opencode server closes on exit ([#3d39a4f](https://github.com/kud/ai-conventional-commit-cli/commit/3d39a4f))

---

## [v3.2.0] — 2026-03-31

### 🐛 Bug Fixes

- Abort process and close server cleanly ([#9c760bb](https://github.com/kud/ai-conventional-commit-cli/commit/9c760bb))

---

## [v3.1.1] — 2026-03-31

### 🐛 Bug Fixes

- Prevent context overflow on large diffs ([#1da34df](https://github.com/kud/ai-conventional-commit-cli/commit/1da34df))

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- chore(debug): add structured debug logging utilities ([#6fcd8a0](https://github.com/kud/ai-conventional-commit-cli/commit/6fcd8a0))

</details>

---

## [v3.1.0] — 2026-03-31

### ✨ Features

- Gracefully close server on process exit ([#e6d4588](https://github.com/kud/ai-conventional-commit-cli/commit/e6d4588))

---

## [v3.0.3] — 2026-03-30

### ✨ Features

- Expand skipFilePatterns defaults ([#023a82e](https://github.com/kud/ai-conventional-commit-cli/commit/023a82e))

---

## [v3.0.2] — 2026-03-30

### ✨ Features

- Parallelise git diff and style profile ([#763dcc8](https://github.com/kud/ai-conventional-commit-cli/commit/763dcc8))

---

## [v3.0.1] — 2026-03-30

### ✨ Features

- Add debug logs for MCP disconnect ([#67e2555](https://github.com/kud/ai-conventional-commit-cli/commit/67e2555))

---

## [v3.0.0] — 2026-03-30

### 📝 Documentation

- Document OpenCode MCP disconnection behaviour ([#cd977c7](https://github.com/kud/ai-conventional-commit-cli/commit/cd977c7))

---

## [v2.0.3] — 2026-03-30

### ✨ Features

- Expand .env.example and update model provider logic ([#c124d4e](https://github.com/kud/ai-conventional-commit-cli/commit/c124d4e))
- Replace inquirer with @inquirer/prompts select ([#bf761d1](https://github.com/kud/ai-conventional-commit-cli/commit/bf761d1))

---

## [v2.0.2] — 2026-03-28

### ✨ Features

- Update dependencies and provider logic ([#9ef52bd](https://github.com/kud/ai-conventional-commit-cli/commit/9ef52bd))

---

## [v2.0.1] — 2026-03-27

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🎨 style(index): improve formatting and exit handling ([#3d00df6](https://github.com/kud/ai-conventional-commit-cli/commit/3d00df6))

</details>

---

## [v2.0.0] — 2026-03-27

### ✨ Features

- Add provider re-export file ([#6603270](https://github.com/kud/ai-conventional-commit-cli/commit/6603270))

---

## [v1.1.1] — 2026-03-27

### ✨ Features

- Reuse running opencode server if available ([#ad46c3c](https://github.com/kud/ai-conventional-commit-cli/commit/ad46c3c))
- Migrate to opencode SDK provider ([#14865e6](https://github.com/kud/ai-conventional-commit-cli/commit/14865e6))
- Switch to @opencode-ai/sdk for OpenCodeProvider ([#9542714](https://github.com/kud/ai-conventional-commit-cli/commit/9542714))

---

## [v1.1.0] — 2025-11-27

### ✨ Features

- Support OPENCODE_FREE_MODEL as default ([#f5ffa8f](https://github.com/kud/ai-conventional-commit-cli/commit/f5ffa8f))

---

## [v1.0.1] — 2025-11-19

### ✨ Features

- Document --yes flag for auto-confirm ([#23b4a6b](https://github.com/kud/ai-conventional-commit-cli/commit/23b4a6b))

---

## [v1.0.0] — 2025-11-18

### ✨ Features

- Add @inquirer/prompts for improved selection ([#0e0c61a](https://github.com/kud/ai-conventional-commit-cli/commit/0e0c61a))
- Replace confirm with list for yes/no prompts ([#5efee79](https://github.com/kud/ai-conventional-commit-cli/commit/5efee79))

---

## [v0.13.2] — 2025-11-17

### ✨ Features

- Simplify yes/no prompt to confirm ([#6324a64](https://github.com/kud/ai-conventional-commit-cli/commit/6324a64))
- Improve diff summary for deleted files ([#033e9c7](https://github.com/kud/ai-conventional-commit-cli/commit/033e9c7))

---

## [v0.13.1] — 2025-11-17

### ✨ Features

- Handle renamed files in staged status ([#9d55ed0](https://github.com/kud/ai-conventional-commit-cli/commit/9d55ed0))

---

## [v0.13.0] — 2025-10-27

### ✨ Features

- Handle renamed files in diff parsing ([#e7c7328](https://github.com/kud/ai-conventional-commit-cli/commit/e7c7328))

---

## [v0.12.13] — 2026-03-27

### 📝 Documentation

- Document maxFileLines and skipFilePatterns ([#f941438](https://github.com/kud/ai-conventional-commit-cli/commit/f941438))

---

## [v0.12.12] — 2025-10-08

### ✨ Features

- Support OPENCODE_FREE_MODEL as default ([#2c9308d](https://github.com/kud/ai-conventional-commit-cli/commit/2c9308d))

---

## [v0.12.11] — 2025-10-08

### ✨ Features

- Handle zero-diff files in summary bar ([#f0bf4e5](https://github.com/kud/ai-conventional-commit-cli/commit/f0bf4e5))

---

## [v0.12.10] — 2025-10-08

### ♻️ Refactoring

- Streamline file summary line construction ([#7fc5de4](https://github.com/kud/ai-conventional-commit-cli/commit/7fc5de4))

---

## [v0.12.9] — 2025-10-08

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: feat/git: indicate deleted files in diff summary ([#5c5eb77](https://github.com/kud/ai-conventional-commit-cli/commit/5c5eb77))

</details>

---

## [v0.12.8] — 2025-10-08

### ♻️ Refactoring

- Remove zero-change file borderLine output ([#9f5d9f2](https://github.com/kud/ai-conventional-commit-cli/commit/9f5d9f2))

---

## [v0.12.7] — 2025-10-08

### 🐛 Bug Fixes

- Reattach branch after rebase if detached ([#e9ed56b](https://github.com/kud/ai-conventional-commit-cli/commit/e9ed56b))

---

## [v0.12.6] — 2025-10-08

### 🐛 Bug Fixes

- Prevent detached HEAD after reword rebase ([#5c19afd](https://github.com/kud/ai-conventional-commit-cli/commit/5c19afd))

---

## [v0.12.4] — 2025-10-08

### ✨ Features

- Improve commit reword output formatting ([#b6166da](https://github.com/kud/ai-conventional-commit-cli/commit/b6166da))

---

## [v0.12.3] — 2025-10-08

### 📝 Documentation

- Clarify reword command usage examples ([#0e5112f](https://github.com/kud/ai-conventional-commit-cli/commit/0e5112f))

---

## [v0.12.2] — 2025-10-08

### ✨ Features

- Load package version at runtime ([#b178594](https://github.com/kud/ai-conventional-commit-cli/commit/b178594))

---

## [v0.12.1] — 2025-10-08

### 📝 Documentation

- Add reword command usage and details ([#a4058c9](https://github.com/kud/ai-conventional-commit-cli/commit/a4058c9))

---

## [v0.12.0] — 2025-10-08

### ✨ Features

- Add style and model override options to RewordCommand ([#67de645](https://github.com/kud/ai-conventional-commit-cli/commit/67de645))

---

## [v0.11.1] — 2025-10-04

### ✨ Features

- Add reword command for AI-assisted commit message updates ([#966ba8b](https://github.com/kud/ai-conventional-commit-cli/commit/966ba8b))

---

## [v0.11.0] — 2025-10-04

### ✨ Features

- Enforce required scope in title format ([#c1d0a0c](https://github.com/kud/ai-conventional-commit-cli/commit/c1d0a0c))

---

## [v0.10.0] — 2025-10-04

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: update minimum Node.js version to 20.0.0 ([#a647202](https://github.com/kud/ai-conventional-commit-cli/commit/a647202))

</details>

---

## [v0.9.0] — 2025-09-30

### ✨ Features

- Add diffstat bar chart to file summary ([#9942b54](https://github.com/kud/ai-conventional-commit-cli/commit/9942b54))

---

## [v0.8.2] — 2025-09-29

### ♻️ Refactoring

- Remove programmatic title length enforcement ([#761924e](https://github.com/kud/ai-conventional-commit-cli/commit/761924e))

---

## [v0.8.1] — 2025-09-12

### ✨ Features

- Handle staged files with no diff output ([#f5ae952](https://github.com/kud/ai-conventional-commit-cli/commit/f5ae952))

---

## [v0.8.0] — 2025-09-11

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: bump zod dependency to 4.1.8 ([#d121375](https://github.com/kud/ai-conventional-commit-cli/commit/d121375))

</details>

---

## [v0.7.2] — 2025-09-11

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: update dependencies for inquirer, chalk, keyv, strip-ansi, zod ([#0787184](https://github.com/kud/ai-conventional-commit-cli/commit/0787184))

</details>

---

## [v0.7.1] — 2025-09-11

### 🐛 Bug Fixes

- Update default model timeout to 120000ms ([#50b3081](https://github.com/kud/ai-conventional-commit-cli/commit/50b3081))

---

## [v0.6.0] — 2025-09-08

### ✨ Features

- Improve commit block description formatting ([#13f7281](https://github.com/kud/ai-conventional-commit-cli/commit/13f7281))

### 📝 Documentation

- Update CLI flags and config instructions for style option ([#268d0fc](https://github.com/kud/ai-conventional-commit-cli/commit/268d0fc))

### 📦 Other

- Bump version to 0.7.0 ([#a965dae](https://github.com/kud/ai-conventional-commit-cli/commit/a965dae))

---

## [v0.5.0] — 2025-09-08

### ✨ Features

- Update default model to github-copilot/gpt-4.1 ([#ef10bc7](https://github.com/kud/ai-conventional-commit-cli/commit/ef10bc7))

---

## [v0.4.4] — 2025-09-08

### ✨ Features

- Display model name in animated header ([#a861378](https://github.com/kud/ai-conventional-commit-cli/commit/a861378))

---

## [v0.4.3] — 2025-09-08

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🏗️ build: remove deprecated aicc CLI alias ([#9a11f94](https://github.com/kud/ai-conventional-commit-cli/commit/9a11f94))

</details>

---

## [v0.4.2] — 2025-09-08

### 📦 Other

- Add trailing blank line after final success/abort messages ([#241197b](https://github.com/kud/ai-conventional-commit-cli/commit/241197b))

---

## [v0.4.1] — 2025-09-08

### 📝 Documentation

- Enrich README with badges, TOC, plugin example & workflow ([#01257df](https://github.com/kud/ai-conventional-commit-cli/commit/01257df))

---

## [v0.4.0] — 2025-09-08

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: add repository, bugs and homepage fields to package.json ([#530aad4](https://github.com/kud/ai-conventional-commit-cli/commit/530aad4))

</details>

---

## [v0.3.0] — 2025-09-07

### ✨ Features

- Add help/version commands, files field, new UI; remove reasoning ([#aa07e2e](https://github.com/kud/ai-conventional-commit-cli/commit/aa07e2e))

---

## [v0.2.1] — 2025-09-06

### ✨ Features

- Add animated header and improve generate CLI output ([#3f9ca7f](https://github.com/kud/ai-conventional-commit-cli/commit/3f9ca7f))

---

## [v0.2.0] — 2025-09-06

<details>
<summary>🔧 Internal changes (1 commits)</summary>

- 🧹 chore: remove legacy aicc alias references and align binary/log namin ([#9773929](https://github.com/kud/ai-conventional-commit-cli/commit/9773929))

</details>

---
