import { select } from '@inquirer/prompts';
import { execa } from 'execa';

const MODEL_LINE_RE = /^[a-z0-9_.-]+\/[A-Za-z0-9_.:-]+$/;

export const isTimeoutError = (e: unknown): boolean =>
  e instanceof Error && /timed out/i.test(e.message);

const fetchAvailableModels = async (): Promise<string[]> => {
  const { stdout } = await execa('opencode', ['models']);
  return Array.from(
    new Set(
      stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => MODEL_LINE_RE.test(l)),
    ),
  );
};

export const pickModelOnTimeout = async (timedOutModel: string): Promise<string | undefined> => {
  let models: string[];
  try {
    models = await fetchAvailableModels();
  } catch {
    return undefined;
  }

  const others = models.filter((m) => m !== timedOutModel);
  if (others.length === 0) return undefined;

  const choices = [
    ...others.map((m) => ({ name: m, value: m })),
    { name: `${timedOutModel} (timed out)`, value: timedOutModel, disabled: true as const },
  ];

  console.error('');
  return select({
    message: `"${timedOutModel}" timed out — pick another model to retry:`,
    choices,
    pageSize: 15,
  });
};
