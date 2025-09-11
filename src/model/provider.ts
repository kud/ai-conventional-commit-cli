import { z } from 'zod';

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

import { execa } from 'execa';

export class OpenCodeProvider implements Provider {
  constructor(private model: string = 'github-copilot/gpt-4.1') {}

  name() {
    return 'opencode';
  }

  async chat(messages: ChatMessage[], _opts?: { maxTokens?: number; temperature?: number }) {
    const debug = process.env.AICC_DEBUG === 'true';
    const mockMode = process.env.AICC_DEBUG_PROVIDER === 'mock';

    const timeoutMs = parseInt(process.env.AICC_MODEL_TIMEOUT_MS || '120000', 10);
    const eager = process.env.AICC_EAGER_PARSE !== 'false'; // enabled by default

    // Aggregate messages into a single prompt; keep simple for now.
    const userAggregate = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const command = `Generate high-quality commit message candidates based on the staged git diff.`;
    const fullPrompt = `${command}\n\nContext:\n${userAggregate}`;

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

    const start = Date.now();

    return await new Promise<string>((resolve, reject) => {
      let resolved = false;
      let acc = '';

      // Pass prompt as single variadic argument (original working form). If it becomes too long, we could chunk, but opencode accepted this previously.
      const includeLogs = process.env.AICC_PRINT_LOGS === 'true';
      const args = ['run', fullPrompt, '--model', this.model];
      if (includeLogs) args.push('--print-logs');
      const subprocess = execa('opencode', args, {
        timeout: timeoutMs,
        input: '', // immediately close stdin in case CLI waits for it
      });

      const finish = (value: string) => {
        if (resolved) return;
        resolved = true;
        const elapsed = Date.now() - start;
        if (debug) {
          console.error(
            `[ai-cc][provider] model=${this.model} elapsedMs=${elapsed} promptChars=${fullPrompt.length} bytesOut=${value.length}`,
          );
        }
        resolve(value);
      };

      const tryEager = () => {
        if (!eager) return;
        // naive detection: first '{' to last '}'
        const first = acc.indexOf('{');
        const last = acc.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          const candidate = acc.slice(first, last + 1).trim();
          try {
            JSON.parse(candidate); // just to validate shape; parsing again later by caller
            if (debug) console.error('[ai-cc][provider] eager JSON detected, terminating process');
            subprocess.kill('SIGTERM');
            finish(candidate);
          } catch {
            /* ignore until complete */
          }
        }
      };

      subprocess.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        acc += text;
        tryEager();
      });

      subprocess.stderr?.on('data', (chunk) => {
        if (debug) console.error('[ai-cc][provider][stderr]', chunk.toString().trim());
      });

      subprocess
        .then(({ stdout }) => {
          if (!resolved) finish(stdout);
        })
        .catch((e: any) => {
          if (resolved) return; // ignore errors after eager resolve
          const elapsed = Date.now() - start;
          if (e.timedOut) {
            return reject(
              new Error(`Model call timed out after ${timeoutMs}ms (elapsed=${elapsed}ms)`),
            );
          }
          if (debug) console.error('[ai-cc][provider] failure', e.stderr || e.message);
          reject(new Error(e.stderr || e.message || 'opencode invocation failed'));
        });
    });
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
    jsonText = trimmed; // fast path
  } else {
    const match = raw.match(/\{[\s\S]*\}$/m);
    if (match) jsonText = match[0];
  }
  if (!jsonText) throw new Error('No JSON object detected.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Invalid JSON parse');
  }
  return PlanSchema.parse(parsed);
};
