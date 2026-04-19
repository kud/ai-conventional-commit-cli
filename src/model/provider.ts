import { z } from 'zod';
import { createServer, type AddressInfo } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import { createOpencodeClient } from '@opencode-ai/sdk/v2';
import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';

const pTag = chalk.dim('[ai-cc]') + chalk.cyan('[provider]');
const pdbg = (msg: string, pairs: Record<string, unknown> = {}) => {
  const kvStr = Object.entries(pairs)
    .map(([k, v]) => chalk.dim(k + '=') + chalk.yellow(String(v)))
    .join(' ');
  console.error(pTag, chalk.white(msg), kvStr || '');
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Provider {
  name(): string;
  warmup(): void;
  close(): Promise<void>;
  chat(
    messages: ChatMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
}

export const createProvider = (model: string): Provider => {
  if (model.startsWith('claude/')) return new ClaudeCliProvider(model);
  if (model.startsWith('anthropic/')) return new AnthropicProvider(model);
  return new OpenCodeProvider(model);
};

const killProcessGroup = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal);
  } catch {}
};

const gracefulKill = (proc: ChildProcess): Promise<void> => {
  if (proc.exitCode !== null || !proc.pid) return Promise.resolve();
  const pgid = proc.pid;

  return new Promise<void>((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve();
    };
    proc.once('exit', onExit);

    killProcessGroup(pgid, 'SIGTERM');

    const timer = setTimeout(() => {
      proc.off('exit', onExit);
      proc.once('exit', () => resolve());
      killProcessGroup(pgid, 'SIGKILL');
      console.warn(
        chalk.yellow('\n⚠ [ai-cc]') +
          ' opencode server did not shut down cleanly and had to be force-killed.' +
          chalk.dim(
            ' Please report this at https://github.com/kud/ai-conventional-commit-cli/issues/new',
          ),
      );
    }, 1000);
  });
};

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

interface WarmContext {
  client: ReturnType<typeof createOpencodeClient>;
  server: { url: string };
  sessionID: string;
}

export class OpenCodeProvider implements Provider {
  private warmPromise: Promise<WarmContext> | null = null;
  private ac = new AbortController();
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private readonly exitHandler: () => void;
  private syncClose: (() => void) | null = null;
  private serverProc: ChildProcess | null = null;

  constructor(private model: string = 'github-copilot/gpt-4.1') {
    this.timeoutMs = parseInt(process.env.AICC_MODEL_TIMEOUT_MS || '120000', 10);
    this.debug = process.env.AICC_DEBUG === 'true';
    setTimeout(() => this.ac.abort(), this.timeoutMs);

    this.exitHandler = () => {
      this.syncClose?.();
      void this._closeServer();
    };
    process.once('exit', this.exitHandler);
    process.once('SIGINT', this.exitHandler);
    process.once('SIGTERM', this.exitHandler);
  }

  private async _closeServer(): Promise<void> {
    try {
      if (this.serverProc) {
        await gracefulKill(this.serverProc);
        this.serverProc = null;
      }
      this.ac.abort();
      this.warmPromise?.catch(() => {});
    } finally {
      process.off('exit', this.exitHandler);
      process.off('SIGINT', this.exitHandler);
      process.off('SIGTERM', this.exitHandler);
    }
  }

  async close(): Promise<void> {
    return this._closeServer();
  }

  name() {
    return 'opencode';
  }

  warmup(): void {
    if (!this.warmPromise) {
      this.warmPromise = this._startServer();
    }
  }

  private async _startServer(): Promise<WarmContext> {
    if (this.debug) pdbg('starting opencode server');

    // Isolate opencode from the user's global MCP config by pointing
    // XDG_CONFIG_HOME to a temp dir with a minimal (MCP-free) config.
    const isolatedDir = join(tmpdir(), `aicc-${process.pid}`, 'opencode');
    mkdirSync(isolatedDir, { recursive: true });
    writeFileSync(join(isolatedDir, 'config.json'), '{"mcp":{}}');

    const port = await findFreePort();

    const originalXDG = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = join(tmpdir(), `aicc-${process.pid}`);

    const proc = spawn('opencode', ['serve', `--hostname=127.0.0.1`, `--port=${port}`], {
      detached: true,
      env: { ...process.env, OPENCODE_CONFIG_CONTENT: JSON.stringify({ mcp: {} }) },
    });

    this.serverProc = proc;
    this.syncClose = () => killProcessGroup(proc.pid!, 'SIGKILL');

    // Restore env immediately — the child already captured it at spawn time.
    if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXDG;

    const url = await new Promise<string>((resolve, reject) => {
      const id = setTimeout(
        () => reject(new Error(`Timeout waiting for opencode server after 10s`)),
        10_000,
      );
      let output = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        for (const line of output.split('\n')) {
          if (!line.startsWith('opencode server listening')) continue;
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (!match) {
            reject(new Error(`Failed to parse server url: ${line}`));
            return;
          }
          clearTimeout(id);
          resolve(match[1]);
          return;
        }
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      proc.on('exit', (code) => {
        clearTimeout(id);
        reject(new Error(`Server exited with code ${code}\n${output}`));
      });
      proc.on('error', (err) => {
        clearTimeout(id);
        reject(err);
      });
      this.ac.signal.addEventListener('abort', () => {
        clearTimeout(id);
        killProcessGroup(proc.pid!, 'SIGKILL');
        reject(new Error('Aborted'));
      });
    });

    const client = createOpencodeClient({ baseUrl: url });

    if (this.debug) {
      const mcpStatusResult = await client.mcp.status();
      pdbg('mcp status', { status: JSON.stringify(mcpStatusResult.data) });
    }

    const sessionResult = await client.session.create({ title: 'aicc' });
    if (!sessionResult.data) {
      const errMsg =
        (sessionResult.error as any)?.message ?? JSON.stringify(sessionResult.error) ?? 'unknown';
      throw new Error(`Failed to create opencode session: ${errMsg}`);
    }

    if (this.debug) pdbg('session created', { id: sessionResult.data.id });

    return {
      client,
      server: { url },
      sessionID: sessionResult.data.id,
    };
  }

  async chat(messages: ChatMessage[], _opts?: { maxTokens?: number; temperature?: number }) {
    const mockMode = process.env.AICC_DEBUG_PROVIDER === 'mock';

    if (mockMode) {
      if (this.debug) pdbg('mock mode — returning deterministic response');
      return JSON.stringify({
        commits: [
          {
            title: 'chore: mock commit from provider',
            body: '',
            score: 80,
            reasons: ['mock mode'],
          },
        ],
        meta: { splitRecommended: false },
      });
    }

    const userAggregate = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const fullPrompt = `Generate high-quality commit message candidates based on the staged git diff.\n\nContext:\n${userAggregate}`;

    const slashIdx = this.model.indexOf('/');
    const providerID = slashIdx !== -1 ? this.model.slice(0, slashIdx) : this.model;
    const modelID = slashIdx !== -1 ? this.model.slice(slashIdx + 1) : this.model;

    const start = Date.now();

    try {
      const ctx = await (this.warmPromise ?? this._startServer());

      if (this.debug) {
        pdbg('sending prompt', { model: this.model, promptChars: fullPrompt.length });
      }

      const result = await ctx.client.session.prompt({
        sessionID: ctx.sessionID,
        model: { providerID, modelID },
        format: {
          type: 'json_schema',
          schema: COMMIT_PLAN_JSON_SCHEMA,
        },
        parts: [{ type: 'text', text: fullPrompt }],
      });

      if (this.debug) {
        const elapsed = Date.now() - start;
        pdbg('response received', {
          model: this.model,
          elapsedMs: elapsed,
          promptChars: fullPrompt.length,
        });
        pdbg('result.data', { json: JSON.stringify(result.data, null, 2) });
      }

      const structured = (result.data as any)?.info?.structured;
      if (structured == null) {
        const err = (result.data as any)?.info?.error;
        throw new Error(
          err ? `Model error: ${JSON.stringify(err)}` : 'No structured output in response',
        );
      }

      return JSON.stringify(structured);
    } catch (e: any) {
      if (this.ac.signal.aborted) {
        throw new Error(`Model call timed out after ${this.timeoutMs}ms`);
      }
      if (this.debug) pdbg(chalk.red('call failed'), { error: e.message });
      throw new Error(e.message || 'opencode SDK call failed');
    }
  }
}

export class ClaudeCliProvider implements Provider {
  private readonly modelAlias: string;
  private readonly debug: boolean;

  constructor(model: string = 'claude/sonnet') {
    const slashIdx = model.indexOf('/');
    this.modelAlias = slashIdx !== -1 ? model.slice(slashIdx + 1) : model;
    this.debug = process.env.AICC_DEBUG === 'true';
  }

  name() {
    return 'claude-cli';
  }

  warmup(): void {}

  async close(): Promise<void> {}

  async chat(messages: ChatMessage[], _opts?: { maxTokens?: number; temperature?: number }) {
    if (process.env.AICC_DEBUG_PROVIDER === 'mock') {
      return JSON.stringify({
        commits: [
          {
            title: 'chore: mock commit from provider',
            body: '',
            score: 80,
            reasons: ['mock mode'],
          },
        ],
        meta: { splitRecommended: false },
      });
    }

    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const args = [
      '-p',
      '--output-format',
      'json',
      '--no-session-persistence',
      '--model',
      this.modelAlias,
    ];

    if (this.debug)
      pdbg('spawning claude cli', { model: this.modelAlias, promptChars: prompt.length });

    return new Promise<string>((resolve, reject) => {
      const proc = spawn('claude', args);

      proc.stdin?.write(prompt);
      proc.stdin?.end();

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`claude cli exited with code ${code}: ${stderr}`));
          return;
        }
        try {
          const envelope = JSON.parse(stdout);
          if (envelope.is_error) {
            reject(new Error(`claude cli error: ${envelope.result}`));
            return;
          }
          const result =
            typeof envelope.result === 'string' ? envelope.result : JSON.stringify(envelope.result);
          if (this.debug) pdbg('claude cli response', { resultChars: result.length });
          resolve(result);
        } catch (e: any) {
          reject(new Error(`Failed to parse claude cli output: ${e.message}\n${stdout}`));
        }
      });
    });
  }
}

export class AnthropicProvider implements Provider {
  private readonly modelID: string;
  private readonly debug: boolean;
  private readonly client: Anthropic;

  constructor(model: string = 'anthropic/claude-sonnet-4-6') {
    const slashIdx = model.indexOf('/');
    this.modelID = slashIdx !== -1 ? model.slice(slashIdx + 1) : model;
    this.debug = process.env.AICC_DEBUG === 'true';
    this.client = new Anthropic();
  }

  name() {
    return 'anthropic';
  }

  warmup(): void {}

  async close(): Promise<void> {}

  async chat(messages: ChatMessage[], opts?: { maxTokens?: number }) {
    if (process.env.AICC_DEBUG_PROVIDER === 'mock') {
      return JSON.stringify({
        commits: [
          {
            title: 'chore: mock commit from provider',
            body: '',
            score: 80,
            reasons: ['mock mode'],
          },
        ],
        meta: { splitRecommended: false },
      });
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const conversationMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    if (this.debug) pdbg('anthropic call', { model: this.modelID, msgs: conversationMsgs.length });

    const response = await this.client.messages.create({
      model: this.modelID,
      max_tokens: opts?.maxTokens ?? 1024,
      system: systemMsg?.content,
      messages: conversationMsgs,
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '';

    if (this.debug) pdbg('anthropic response', { chars: text.length });

    return text;
  }
}

const CommitSchema = z.object({
  title: z.string().min(5).max(150),
  body: z.string().optional().default(''),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()).optional().default([]),
  files: z.array(z.string()).optional().default([]),
});

export const PlanSchema = z.object({
  commits: z.array(CommitSchema).min(1),
  meta: z
    .object({
      splitRecommended: z.boolean().optional(),
    })
    .optional(),
});

export type CommitPlan = z.infer<typeof PlanSchema>;

const COMMIT_PLAN_JSON_SCHEMA = {
  type: 'object',
  required: ['commits'],
  properties: {
    commits: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['title', 'score'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          reasons: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        splitRecommended: { type: 'boolean' },
      },
    },
  },
};

export const extractJSON = (raw: string): CommitPlan => {
  const trimmed = raw.trim();
  let jsonText: string | null = null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    jsonText = trimmed;
  } else {
    const match = raw.match(/\{[\s\S]*\}$/m);
    if (match) jsonText = match[0];
  }
  if (!jsonText) throw new Error('No JSON object detected.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON parse');
  }
  return PlanSchema.parse(parsed);
};
