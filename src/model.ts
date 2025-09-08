import { z } from 'zod';

const CommitSchema = z.object({
  title: z.string().min(5).max(120),
  body: z.string().optional().default(''),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  files: z.array(z.string()).optional().default([]),
});

const ResponseSchema = z.object({
  commits: z.array(CommitSchema).min(1),
  meta: z
    .object({
      splitRecommended: z.boolean().optional(),
    })
    .optional(),
});

export type ModelResponse = z.infer<typeof ResponseSchema>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Provider {
  name(): string;
  chat(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<string>;
}

export class GitHubCopilotProvider implements Provider {
  constructor(
    private token: string,
    private model = 'github-copilot/gpt-4.1',
  ) {}
  name() {
    return 'github-copilot';
  }

  async chat(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<string> {
    const res = await fetch(`https://api.github.com/models/${this.model}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? 512,
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Model error: ${res.status} ${text}`);
    }
    const data = await res.json();
    // Assuming OpenAI-like shape
    return data.choices?.[0]?.message?.content || '';
  }
}

export const parseModelJSON = (raw: string): ModelResponse => {
  // Attempt to find first JSON object in raw
  const match = raw.match(/\{[\s\S]*\}$/m);
  if (!match) throw new Error('No JSON found in model output');
  const parsed = JSON.parse(match[0]);
  return ResponseSchema.parse(parsed);
};
