import readline from 'node:readline';

export const prompt = async (question: string, defaultValue?: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      if (!answer && defaultValue) return res(defaultValue);
      res(answer);
    });
  });
};

export const chooseIndex = (len: number): Promise<number> =>
  prompt(`Select index 0..${len - 1} (default 0): `, '0').then((a) =>
    Math.min(len - 1, Math.max(0, parseInt(a, 10) || 0)),
  );
