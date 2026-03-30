import { z } from 'zod';
import { createServer, type AddressInfo } from 'node:net';
import { createOpencode } from '@opencode-ai/sdk/v2';

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

export class OpenCodeProvider implements Provider {
  constructor(private model: string = 'github-copilot/gpt-4.1') {}

  name() {
    return 'opencode';
  }

  async chat(messages: ChatMessage[], _opts?: { maxTokens?: number; temperature?: number }) {
    const debug = process.env.AICC_DEBUG === 'true';
    const mockMode = process.env.AICC_DEBUG_PROVIDER === 'mock';
    const timeoutMs = parseInt(process.env.AICC_MODEL_TIMEOUT_MS || '120000', 10);

    if (mockMode) {
      if (debug) console.error('[ai-cc][mock] Returning deterministic mock response');
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

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const start = Date.now();

    let server: Awaited<ReturnType<typeof createOpencode>>['server'] | undefined;

    try {
      if (debug) console.error('[ai-cc][provider] starting opencode server');
      const port = await findFreePort();
      const opencode = await createOpencode({ signal: ac.signal, port });
      server = opencode.server;
      const client = opencode.client;

      const mcpStatusResult = await client.mcp.status();
      const mcpNames = Object.keys(mcpStatusResult.data ?? {});
      if (mcpNames.length > 0) {
        if (debug) {
          console.error('[ai-cc][provider] mcp status (before disconnect) =', JSON.stringify(mcpStatusResult.data, null, 2));
          console.error(`[ai-cc][provider] disconnecting ${mcpNames.length} MCP servers: ${mcpNames.join(', ')}`);
        }
        await Promise.all(mcpNames.map((name) => client.mcp.disconnect({ name }).catch(() => {})));
        if (debug) {
          const afterStatus = await client.mcp.status();
          console.error('[ai-cc][provider] mcp status (after disconnect) =', JSON.stringify(afterStatus.data, null, 2));
        }
      }

      const sessionResult = await client.session.create({ title: 'aicc' });

      if (!sessionResult.data) {
        const errMsg =
          (sessionResult.error as any)?.message ??
          JSON.stringify(sessionResult.error) ??
          'unknown';
        throw new Error(`Failed to create opencode session: ${errMsg}`);
      }

      const result = await client.session.prompt({
        sessionID: sessionResult.data.id,
        model: { providerID, modelID },
        format: {
          type: 'json_schema',
          schema: COMMIT_PLAN_JSON_SCHEMA,
        },
        parts: [{ type: 'text', text: fullPrompt }],
      });

      if (debug) {
        const elapsed = Date.now() - start;
        console.error(
          `[ai-cc][provider] model=${this.model} elapsedMs=${elapsed} promptChars=${fullPrompt.length}`,
        );
        console.error('[ai-cc][provider] result.data =', JSON.stringify(result.data, null, 2));
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
      if (ac.signal.aborted) {
        throw new Error(`Model call timed out after ${timeoutMs}ms`);
      }
      if (debug) console.error('[ai-cc][provider] failure', e.message);
      throw new Error(e.message || 'opencode SDK call failed');
    } finally {
      clearTimeout(timer);
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
