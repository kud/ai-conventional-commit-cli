<div align="center">

<img src="assets/icon.png" width="128" alt="ai-conventional-commit icon" />

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js_%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/%40kud%2Fai-conventional-commit-cli?style=flat-square&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@kud/ai-conventional-commit-cli)
[![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)](LICENSE)

**Opinionated, style-aware AI assistant for crafting and splitting git commits (opencode-based, provider-agnostic).**

<a href="https://kud.io/projects/ai-conventional-commit-cli">Website</a> · <a href="https://kud.io/projects/ai-conventional-commit-cli/docs">Documentation</a>

</div>

## Features

- **AI-generated conventional commits** — reads your staged diff and produces a Conventional Commits-compliant message in one command.
- **Smart commit splitting** — clusters hunks semantically and proposes multiple atomic commits, each selectively staged and applied.
- **Gitmoji style support** — `standard`, `gitmoji` (emoji + type), and `gitmoji-pure` (emoji only) modes out of the box.
- **Refine & reword** — iteratively reshape the last commit's wording, or reword any past commit by hash or interactive pick.
- **Plugin system** — register custom `transform` and `validate` hooks to enforce team conventions or post-process candidates.
- **Privacy-aware diff filtering** — three tiers (`low` / `medium` / `high`) control exactly how much code is sent to the model.

## Install

```sh
npm install -g @kud/ai-conventional-commit-cli
```

## Usage

```console
$ git add .
$ ai-conventional-commit
✔ feat(api): add pagination metadata to list endpoint

$ ai-conventional-commit split
1. refactor(parser): simplify token scanning
2. feat(parser): support negated glob segments
3. test(parser): add cases for brace + extglob combos

$ ai-conventional-commit refine --shorter
$ ai-conventional-commit refine --scope ui
$ ai-conventional-commit reword HEAD
$ ai-conventional-commit models --interactive --save
$ ai-conventional-commit config set style gitmoji
```

## Development

```sh
git clone https://github.com/kud/ai-conventional-commit-cli.git
cd ai-conventional-commit-cli
npm install
npm run dev -- generate
```

📚 **Full documentation → [ai-conventional-commit-cli/docs](https://kud.io/projects/ai-conventional-commit-cli/docs)**
