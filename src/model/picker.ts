import { select } from '@inquirer/prompts';
import { discoverModels, type DiscoveryDeps } from './discovery.js';

export const isTimeoutError = (e: unknown): boolean =>
  e instanceof Error && /timed out/i.test(e.message);

export const pickModelOnTimeout = async (
  timedOutModel: string,
  deps?: DiscoveryDeps,
): Promise<string | undefined> => {
  let models: string[];
  try {
    ({ models } = await discoverModels(deps));
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
