#!/usr/bin/env node
// ai-conventional-commit-cli / command: ai-conventional-commit (alias: aicc)
// AI Conventional Commit generator. Providers: codex, claude, opencode.
// Modern implementation using zx with optional fancy boxed output + interactive confirm & single-model invocation (no fallback).

import { $, argv } from 'zx';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ---------- config / env ----------
function env(k, def) { return process.env[k] ?? def; }
function intEnv(k, def) { return process.env[k] ? parseInt(process.env[k], 10) : def; }
function boolEnv(k, def) { return process.env[k] ? ['1','true','yes'].includes(process.env[k].toLowerCase()) : def; }

// Manual flag scan (zx already parsed into argv._ but we treat all tokens)
const optMap = new Map();
for (let i = 0; i < argv._.length; i++) {
  const token = argv._[i];
  if (typeof token !== 'string') continue;
  if (!token.startsWith('-')) continue; // ignore positionals
  switch (token) {
    case '--dry-run': optMap.set('dryRun', true); break;
    case '--verbose': optMap.set('verbose', true); break;
    case '--plain': optMap.set('plain', true); break;
    case '--debug': optMap.set('debug', true); break;
    case '--show-defaults': optMap.set('showDefaults', true); break;
    case '--yes':
    case '--no-confirm': optMap.set('yes', true); break;
    case '-h':
    case '--help': printHelpAndExit(); break;
    default: {
      const expectsVal = [ '--provider','--model','--type','--scope','--max-subject','--wrap' ];
      if (expectsVal.includes(token)) {
        const val = argv._[i + 1];
        if (val === undefined || String(val).startsWith('-')) die(`missing value for ${token}`);
        optMap.set(token.replace(/^--/, ''), val); i++;
      } else die(`unknown option: ${token}`);
    }
  }
}

const opts = {
  provider: optMap.get('provider') || env('AICC_PROVIDER', 'opencode'),
  model: optMap.get('model') || env('AICC_MODEL', ''),
  type: optMap.get('type') || env('AICC_TYPE', ''),
  scope: optMap.get('scope') || env('AICC_SCOPE', ''),
  maxSubject: parseInt(optMap.get('max-subject') || intEnv('AICC_MAX_SUBJECT', 72), 10),
  wrap: parseInt(optMap.get('wrap') || intEnv('AICC_WRAP', 72), 10),
  dryRun: optMap.has('dryRun') ? true : boolEnv('AICC_DRY_RUN', false),
  verbose: optMap.has('verbose') ? true : boolEnv('AICC_VERBOSE', false),
  plain: optMap.has('plain') ? true : boolEnv('AICC_PLAIN', false),
  yes: optMap.has('yes') ? true : boolEnv('AICC_YES', false),
  showDefaults: optMap.has('showDefaults') || false,
  debug: optMap.has('debug') ? true : boolEnv('AICC_DEBUG', false)
};

$.verbose = !!opts.verbose; // echo commands in verbose mode

function printHelpAndExit(code = 0) {
  console.log(`Usage: ai-conventional-commit [options]\n  (alias: aicc)\n\nOptions:\n  --provider codex|claude|opencode\n  --model <model>\n  --type <feat|fix|refactor|chore|docs|test|perf|build|ci|style>\n  --scope <scope>\n  --max-subject <n>   (default 72)\n  --wrap <n>          (default 72)\n  --dry-run           (show message only)\n  --verbose           (log internal shell commands)\n  --plain             (disable fancy boxed output)\n  --debug             (print raw provider output + parsed segments)\n  --show-defaults     (print provider default models and exit)\n  --yes / --no-confirm (auto-accept message; skip prompt)\n  -h, --help`);
  process.exit(code);
}

if (opts.showDefaults) {
  console.log('Default provider models (single model, no fallback):');
  console.log('  codex: gpt-5');
  console.log('  claude: claude-sonnet-4-20250514');
  console.log('  opencode: copilot');
  process.exit(0);
}

const useFancy = process.stdout.isTTY && !opts.plain;

function log(msg) { if (opts.verbose) console.error(`[aicc] ${msg}`); }
function debug(msg) { if (opts.debug) console.error(`[aicc][debug] ${msg}`); }
function previewPrompt(p) { const one = (p||'').replace(/\s+/g,' ').trim(); const max = 120; return one.length > max ? one.slice(0, max) + '…' : one; }
function die(msg, code = 1) { console.error(`aicc: ${msg}`); process.exit(code); }

// ---------- preflight ----------
await ensureGitRepo();
const stagedListRaw = (await safeText($`git diff --name-only --cached`)).trim();
if (!stagedListRaw) die('no staged changes. Stage files first (git add …).');
const stagedFiles = stagedListRaw.split(/\r?\n/).filter(Boolean);
const diff = await safeText($`git diff --staged --unified=0`);

if (useFancy) fancyStart(stagedFiles);

// ---------- prompt construction ----------
const system = [
  'You are a commit generator that outputs ONLY a Conventional Commit.',
  'Rules:',
  '- Allowed types: feat, fix, refactor, chore, docs, test, perf, build, ci, style',
  `- Subject <= ${opts.maxSubject} chars, no trailing period`,
  `- Body (if any) wrapped at ${opts.wrap} cols`,
  '- Use scope if obvious or provided',
  '- If breaking change, append a "BREAKING CHANGE:" footer',
  '- No emojis; no code fences; no preamble.'
].join('\n');

const user = [
  'Write a Conventional Commit for the staged diff.',
  '',
  'Repository preferences:',
  `- Preferred type (optional): ${opts.type || 'infer'}`,
  `- Preferred scope (optional): ${opts.scope || 'infer'}`,
  '',
  'DIFF:',
  escapeBackticks(diff)
].join('\n');

// ---------- generate (single attempt) ----------
const provider = (opts.provider || 'codex').toLowerCase();
const modelCandidates = candidateModels(provider, opts.model);
let generation;
try {
  generation = await generateCommitMessage({ provider, candidates: modelCandidates, system, user });
} catch (e) {
  fancyFailure('Provider invocation failed');
  die(e.message || e);
}
let { cleaned, modelUsed } = generation;
if (opts.debug) {
  console.error('[aicc][debug] Raw provider cleaned output:\n---\n' + cleaned + '\n---');
}

let { subject, body } = extractCommit(cleaned, opts);

// ---------- post-process subject & body enforcement ----------
if (opts.type) {
  if (/^[a-z]+(\([^)]+\))?:\s/.test(subject)) subject = subject.replace(/^[a-z]+/, opts.type);
  else subject = `${opts.type}: ${subject}`;
}
if (opts.scope) {
  if (/^[a-z]+\([^)]+\):\s/.test(subject)) subject = subject.replace(/^([a-z]+)\([^)]+\):/, `$1(${opts.scope}):`);
  else subject = subject.replace(/^([a-z]+):\s/, `$1(${opts.scope}): `);
}
subject = subject.replace(/\s*\.$/, '');
if (subject.length > opts.maxSubject) subject = subject.slice(0, opts.maxSubject);
if (!/^(feat|fix|refactor|chore|docs|test|perf|build|ci|style)(\([^)]+\))?:\s/.test(subject)) {
  subject = `chore: ${subject.replace(/^[a-z]+(\([^)]+\))?:\s/, '')}`;
}
if (body.trim()) body = '\n' + wrapText(body.trim(), opts.wrap); else body = '';

if (opts.debug) {
  console.error('[aicc][debug] Parsed subject:', JSON.stringify(subject));
  console.error('[aicc][debug] Parsed body:', JSON.stringify(body));
}
let finalMessage = subject + body;

const interactive = process.stdout.isTTY && process.stdin.isTTY && !opts.dryRun && !opts.yes;

if (useFancy) fancyShowMessage(finalMessage, interactive, provider, modelUsed);
else if (interactive) {
  console.log('--- Proposed Commit Message ---\n');
  console.log(finalMessage + '\n');
  console.log('--------------------------------');
}

if (opts.dryRun) {
  if (!useFancy) process.stdout.write(finalMessage + '\n');
  else fancyDryRunComplete();
  process.exit(0);
}

// ---------- interactive loop ----------
if (interactive) {
  while (true) {
    const action = await promptAction();
    if (action === 'y') {
      break; // proceed to commit
    } else if (action === 'c') {
      if (useFancy) console.log('└  Aborted (no commit created)');
      else console.log('Aborted (no commit created)');
      process.exit(0); // graceful cancel
    } else if (action === 'r') {
      if (useFancy) console.log('│\n◇  Retrying with provider…');
      try {
        generation = await generateCommitMessage({ provider, candidates: modelCandidates, system, user });
        ({ cleaned, modelUsed } = generation);
        if (opts.debug) console.error('[aicc][debug] Retry cleaned output:\n---\n' + cleaned + '\n---');
        ({ subject, body } = extractCommit(cleaned, opts));
        if (opts.type) {
          if (/^[a-z]+(\([^)]+\))?:\s/.test(subject)) subject = subject.replace(/^[a-z]+/, opts.type);
          else subject = `${opts.type}: ${subject}`;
        }
        if (opts.scope) {
          if (/^[a-z]+\([^)]+\):\s/.test(subject)) subject = subject.replace(/^([a-z]+)\([^)]+\):/, `$1(${opts.scope}):`);
          else subject = subject.replace(/^([a-z]+):\s/, `$1(${opts.scope}): `);
        }
        subject = subject.replace(/\s*\.$/, '');
        if (subject.length > opts.maxSubject) subject = subject.slice(0, opts.maxSubject);
        if (!/^(feat|fix|refactor|chore|docs|test|perf|build|ci|style)(\([^)]+\))?:\s/.test(subject)) {
          subject = `chore: ${subject.replace(/^[a-z]+(\([^)]+\))?:\s/, '')}`;
        }
if (body.trim()) body = '\n' + wrapText(body.trim(), opts.wrap); else body = '';
if (opts.debug) {
  console.error('[aicc][debug] Parsed subject:', JSON.stringify(subject));
  console.error('[aicc][debug] Parsed body:', JSON.stringify(body));
}
        finalMessage = subject + body;
        if (useFancy) fancyShowMessage(finalMessage, true, provider, modelUsed, true);
        else {
          console.log('\n--- Proposed Commit Message (retry) ---\n');
            console.log(finalMessage + '\n');
            console.log('---------------------------------------');
        }
      } catch (e) {
        fancyFailure('Retry failed');
        die(e.message || e);
      }
    } else {
      // loop again for invalid
    }
  }
}

// Re-check staged state then commit
const stagedAgain = (await safeText($`git diff --name-only --cached`)).trim();
if (!stagedAgain) { fancyFailure('Staged files disappeared'); die('no staged changes at commit time'); }
try {
  await $({ input: finalMessage })`git commit -F -`;
  if (useFancy) fancySuccess();
  else console.log('✔ commit created');
} catch (e) {
  if (useFancy) fancyFailure('Commit failed');
  die(`git commit failed: ${e.exitCode ?? ''} ${e.message}`);
}

// ---------- fancy output helpers ----------
function fancyStart(files) {
  console.log('┌   ai-conventional-commit');
  console.log('│');
  console.log(`◇  Detected ${files.length} staged file${files.length === 1 ? '' : 's'}:`);
  for (const f of files) console.log(`     ${f}`);
  console.log('│');
}
function fancyShowMessage(msg, interactive, provider, model, isRetry = false) {
  console.log(isRetry ? '◇  Changes re-analyzed' : '◇  Changes analyzed');
  console.log('│');
  console.log(`◇  Using model: ${provider}:${model}`);
  console.log('│');
  console.log('◇  Proposed commit message:');
  // only show first 20 lines (body rarely that long); indicate truncation
  const lines = msg.split(/\r?\n/);
  const limit = 20;
  const shown = lines.slice(0, limit);
  console.log('\n   ' + shown.join('\n   '));
  if (lines.length > limit) console.log(`\n   … (${lines.length - limit} more lines truncated)`);
if (interactive) {
  if (opts.debug) console.error('[aicc][debug] Entering interactive loop');
    console.log('\n│  Actions: [y] commit  [r] retry  [c] cancel');
    console.log('│');
  } else {
    console.log('\n│  (auto-accepted)');
    console.log('│');
  }
}
function fancySuccess() { console.log('└  ✔ Successfully committed!'); }
function fancyDryRunComplete() { console.log('└  (dry run only — not committed)'); }
function fancyFailure(reason) { if (useFancy) console.log(`└  ✖ ${reason}`); }

// ---------- generic helpers ----------
function candidateModels(provider, requested) {
  if (requested) return [requested];
  let base;
  switch (provider) {
    case 'codex': base = ['gpt-5']; break; // single default
    case 'claude': base = ['claude-sonnet-4-20250514']; break; // updated default
    case 'opencode': base = ['copilot']; break; // updated default
    default: base = ['gpt-5'];
  }
  return base;
}

async function generateCommitMessage({ provider, candidates, system, user }) {
  const unsupported = [];
  for (const model of candidates) {
    log(`attempt model=${model}`);
    let raw = '';
    try {
      await ensureCli(provider === 'codex' ? 'codex' : provider === 'claude' ? 'claude' : 'opencode');
      raw = await invokeProvider(provider, model, system, user);
    } catch (e) {
      const msg = e.stderr || e.message || '';
      if (/Unsupported model/i.test(msg)) { unsupported.push(model); continue; }
      throw new Error(msg || 'provider call failed');
    }
    const cleaned = stripFences(trimBoth(raw));
    if (/Unsupported model/i.test(cleaned)) { unsupported.push(model); continue; }
    if (!cleaned.trim()) throw new Error('empty message from provider');
    return { cleaned, modelUsed: model };
  }
  throw new Error(`unsupported model: ${unsupported.join(', ')}. Provide a valid model with --model <name>.`);
}
async function invokeProvider(provider, model, system, user) {
  switch (provider) {
    case 'codex': {
      const prompt = system + '\n\n' + user;
      debug(`Exec command: codex exec -m ${model} <prompt:${previewPrompt(prompt)}>`);
      const proc = await $`codex exec -m ${model} ${prompt}`; return proc.stdout; }
    case 'claude': {
      // Claude splits system vs user differently; we still preview combined
      const combined = `${system}\n${user}`;
      debug(`Exec command: claude -p --model ${model} --append-system-prompt <system+user:${previewPrompt(combined)}>`);
      const proc = await $`claude -p --model ${model} --append-system-prompt ${system} ${user}`; return proc.stdout; }
    case 'opencode': {
      const prompt = system + '\n\n' + user;
      debug(`Exec command: opencode run -m ${model} <prompt:${previewPrompt(prompt)}>`);
      const proc = await $`opencode run -m ${model} ${prompt}`; return proc.stdout; }
    default: throw new Error(`unknown provider: ${provider}`);
  }
}
function escapeBackticks(s) { return s.replace(/`/g, '\\`'); }
function firstLine(s) { return s.split(/\r?\n/)[0] ?? ''; }
function restLines(s) { const lines = s.split(/\r?\n/); lines.shift(); return lines.join('\n'); }
function trimBoth(s) { return (s || '').replace(/^\s+/, '').replace(/\s+$/, ''); }
function stripFences(s) { return s.replace(/^```[a-zA-Z-]*\s*\n?/, '').replace(/\n?```$/, '').trim(); }
function wrapText(text, width) {
  const out = []; const paras = text.split(/\r?\n{2,}/);
  for (const p of paras) {
    const words = p.replace(/\s+/g, ' ').trim().split(' ');
    let line = '';
    for (const w of words) {
      if (!w) continue;
      if ((line + ' ' + w).trim().length > width) { if (line) out.push(line); line = w; }
      else line = (line ? line + ' ' : '') + w;
    }
    if (line) out.push(line); out.push('');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
function extractCommit(output) {
  // Heuristic: find first line that looks like conventional commit subject
  const lines = output.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    .filter(l => !/^\[?\d{4}-\d{2}-\d{2}T/.test(l)); // drop timestamp-ish lines
  let subjectIndex = lines.findIndex(l => /^(feat|fix|refactor|chore|docs|test|perf|build|ci|style)(\([^)]+\))?:\s/.test(l));
  if (subjectIndex === -1) {
    subjectIndex = 0;
  }
  const subject = lines[subjectIndex] || '';
  const bodyLines = lines.slice(subjectIndex + 1)
    .filter(l => !/^provider=|^model=/.test(l));
  const body = bodyLines.join('\n');
  return { subject, body };
}
async function ensureGitRepo() { try { await $`git rev-parse --git-dir`; } catch { die('not a git repository'); } }
async function ensureCli(cmd) { try { await $`command -v ${cmd}`; } catch { die(`${cmd} CLI not found. Install & authenticate before using aicc.`); } }
async function safeText(procPromise) { try { const r = await procPromise; return r.stdout; } catch (e) { die(e.stderr || e.message || 'command failed'); } }
async function promptAction() {
  const rl = readline.createInterface({ input, output });
  const ans = (await rl.question('Commit this message? [y] commit / [r] retry / [c] cancel: ')).trim().toLowerCase();
  rl.close();
  if (!ans || ans === 'y' || ans === 'yes') return 'y';
  if (ans === 'r' || ans === 'retry') return 'r';
  if (ans === 'c' || ans === 'n' || ans === 'cancel' || ans === 'q') return 'c';
  return ''; // invalid -> loop again
}
