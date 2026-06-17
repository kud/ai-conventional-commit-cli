<div align="center">

<img src="assets/icon.png" width="160" alt="ai-conventional-commit icon" />

&nbsp;

&nbsp;

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js_%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/%40kud%2Fai-conventional-commit-cli?style=flat-square&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@kud/ai-conventional-commit-cli)
[![MIT](https://img.shields.io/badge/MIT-22C55E?style=flat-square)](LICENSE)

**Style-aware AI assistant for crafting and splitting git commits.**

<a href="https://kud.io/projects/ai-conventional-commit-cli">Website</a> · <a href="https://kud.io/projects/ai-conventional-commit-cli/docs">Documentation</a>

</div>

---

Reads your staged diff, learns your repo's commit style, and produces Conventional Commits-compliant messages — one polished commit, or a cleanly split series. Provider-agnostic: OpenCode-routed models, the Claude CLI, or the Anthropic API.

- 🤖 **AI-generated conventional commits** from your staged diff
- ✂️ **Smart commit splitting** into atomic, selectively-staged commits
- 🎨 **Gitmoji styles** — `standard`, `gitmoji`, and `gitmoji-pure`
- 🔒 **Privacy-aware diff filtering** — three tiers control what's sent to the model

## Install

```bash
npm install -g @kud/ai-conventional-commit-cli
```

## Development

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

---

📚 **Full documentation → https://kud.io/projects/ai-conventional-commit-cli/docs**
