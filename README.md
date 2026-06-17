<div align="center">

<img src="assets/icon.png" width="160" alt="ai-conventional-commit icon" />

&nbsp;

&nbsp;

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js_%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/%40kud%2Fai-conventional-commit-cli?style=flat-square&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@kud/ai-conventional-commit-cli)
[![MIT](https://img.shields.io/badge/MIT-22C55E?style=flat-square)](LICENSE)

**Opinionated, style-aware AI assistant for crafting and splitting git commits. Provider-agnostic — supports OpenCode-routed models, direct Claude CLI, and direct Anthropic API.**

<a href="https://kud.io/projects/ai-conventional-commit-cli">Website</a> · <a href="https://kud.io/projects/ai-conventional-commit-cli/docs">Documentation</a>

</div>

---

An opinionated, style-aware AI assistant for crafting and splitting git commits. Provider-agnostic — supports OpenCode-routed models, direct Claude CLI, and direct Anthropic API.

## ✨ Features

- 🤖 **AI-generated conventional commits** — reads your staged diff and produces a Conventional Commits-compliant message in one command
- ✂️ **Smart commit splitting** — clusters hunks semantically and proposes multiple atomic commits, each selectively staged and executed
- 🎨 **Gitmoji style support** — `standard`, `gitmoji` (emoji + type), and `gitmoji-pure` (emoji only) modes out of the box
- ✏️ **Refine & reword** — iteratively reshape the last commit's wording or reword any past commit using natural-language instructions
- 🔌 **Plugin system** — register custom `transform` and `validate` hooks to enforce team conventions or post-process candidates
- 🔒 **Privacy-aware diff filtering** — three tiers (`low` / `medium` / `high`) control exactly how much code is sent to the model
- 🌐 **Provider-agnostic** — any OpenCode-supported model, direct Claude CLI with no API key, or the Anthropic SDK with your own key

## 🚀 Install

```bash
npm install -g @kud/ai-conventional-commit-cli
```

## 📖 Documentation

Full usage, options, and examples live on the docs site:

**→ [kud.io/projects/ai-conventional-commit-cli/docs](https://kud.io/projects/ai-conventional-commit-cli/docs)**

## 🔧 Development

```bash
git clone https://github.com/kud/ai-conventional-commit-cli.git
cd ai-conventional-commit-cli
npm install

# Run without building
npm run dev -- generate

# Or build and link globally
npm run build
npm link
ai-conventional-commit --help
```

## License

MIT © [kud](https://github.com/kud) — Made with ❤️
