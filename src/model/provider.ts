import { z } from 'zod';
import { createOpencode } from '@opencode-ai/sdk';

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
      const opencode = await createOpencode({ signal: ac.signal });
      server = opencode.server;
      const { client } = opencode;

      const session = await client.session.create({ body: { title: 'aicc' } });
      if (!session.data) throw new Error('Failed to create opencode session');

      const result = await client.session.prompt({
        path: { id: session.data.id },
        body: {
          model: { providerID, modelID },
          parts: [{ type: 'text', text: fullPrompt }],
        },
      });

      if (debug) {
        const elapsed = Date.now() - start;
        console.error(
          `[ai-cc][provider] model=${this.model} elapsedMs=${elapsed} promptChars=${fullPrompt.length}`,
        );
      }

      const text =
        (result.data as any).parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.data ?? p.text ?? '')
          .join('') ?? '';

      return text;
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
