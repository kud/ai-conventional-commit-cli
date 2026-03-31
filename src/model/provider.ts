import { z } from 'zod';
import { createServer, type AddressInfo } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createOpencode } from '@opencode-ai/sdk/v2';
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
  chat(
    messages: ChatMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
}

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
  client: Awaited<ReturnType<typeof createOpencode>>['client'];
  server: Awaited<ReturnType<typeof createOpencode>>['server'];
  sessionID: string;
}

export class OpenCodeProvider implements Provider {
  private warmPromise: Promise<WarmContext> | null = null;
  private ac = new AbortController();
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private readonly exitHandler: () => void;

  constructor(private model: string = 'github-copilot/gpt-4.1') {
    this.timeoutMs = parseInt(process.env.AICC_MODEL_TIMEOUT_MS || '120000', 10);
    this.debug = process.env.AICC_DEBUG === 'true';
    setTimeout(() => this.ac.abort(), this.timeoutMs);

    this.exitHandler = () => { void this._closeServer(); };
    process.once('exit', this.exitHandler);
    process.once('SIGINT', this.exitHandler);
    process.once('SIGTERM', this.exitHandler);
  }

  private async _closeServer(): Promise<void> {
    if (!this.warmPromise) return;
    try {
      const ctx = await this.warmPromise;
      ctx.server?.close();
    } catch {
      // server never started — nothing to close
    } finally {
      process.off('exit', this.exitHandler);
      process.off('SIGINT', this.exitHandler);
      process.off('SIGTERM', this.exitHandler);
    }
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

    const originalXDG = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = join(tmpdir(), `aicc-${process.pid}`);

    let opencode: Awaited<ReturnType<typeof createOpencode>>;
    try {
      const port = await findFreePort();
      opencode = await createOpencode({ signal: this.ac.signal, port });
    } finally {
      // Restore immediately — the child process already captured the env at spawn
      if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = originalXDG;
    }

    const { server, client } = opencode;

    if (this.debug) {
      const mcpStatusResult = await client.mcp.status();
      pdbg('mcp status', { status: JSON.stringify(mcpStatusResult.data) });
    }

    const sessionResult = await client.session.create({ title: 'aicc' });
    if (!sessionResult.data) {
      const errMsg =
        (sessionResult.error as any)?.message ??
        JSON.stringify(sessionResult.error) ??
        'unknown';
      throw new Error(`Failed to create opencode session: ${errMsg}`);
    }

    if (this.debug) pdbg('session created', { id: sessionResult.data.id });

    return { client, server, sessionID: sessionResult.data.id };
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
    let server: WarmContext['server'] | undefined;

    try {
      const ctx = await (this.warmPromise ?? this._startServer());
      server = ctx.server;

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
        pdbg('response received', { model: this.model, elapsedMs: elapsed, promptChars: fullPrompt.length });
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
    } finally {
      server?.close();
    }
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
