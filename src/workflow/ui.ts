import chalk from 'chalk';
import type { CommitFailure } from '../git.js';

export function animateHeaderBase(text = 'ai-conventional-commit', modelSegment?: string) {
  const mainText = text;
  const modelSeg = modelSegment ? ` (using ${modelSegment})` : '';

  if (!process.stdout.isTTY || process.env.AICC_NO_ANIMATION) {
    if (modelSeg) console.log('\n\u250C ' + chalk.bold(mainText) + chalk.dim(modelSeg));
    else console.log('\n\u250C ' + chalk.bold(mainText));
    return Promise.resolve();
  }
  const palette = [
    '#3a0d6d',
    '#5a1ea3',
    '#7a32d6',
    '#9a4dff',
    '#b267ff',
    '#c37dff',
    '#b267ff',
    '#9a4dff',
    '#7a32d6',
    '#5a1ea3',
  ];
  process.stdout.write('\n');
  return palette
    .reduce(async (p, color) => {
      await p; // sequential
      const frame = chalk.bold.hex(color)(mainText);
      if (modelSeg) process.stdout.write('\r\u250C ' + frame + chalk.dim(modelSeg));
      else process.stdout.write('\r\u250C ' + frame);
      await new Promise((r) => setTimeout(r, 60));
    }, Promise.resolve())
    .then(() => process.stdout.write('\n'));
}

export function borderLine(content?: string) {
  if (!content) console.log('│');
  else console.log('│ ' + content);
}

export function sectionTitle(label: string) {
  console.log('⊙ ' + chalk.bold(label));
}

export function abortMessage() {
  console.log('└ 🙅‍♀️ No commit created.');
  console.log();
}

export function commitFailureOutput(failure: CommitFailure) {
  // Hooks format and colour their own output, so it goes out untouched rather than
  // re-wrapped in a border that would mangle it.
  if (failure.output) process.stderr.write(failure.output + '\n');
}

export function commitFailureMessage(failure: CommitFailure) {
  if (failure.rejectedByHook) {
    console.log('└ 🙅‍♀️ A git hook refused the commit. Nothing was committed.');
  } else {
    console.log(`└ 💥 git commit failed (exit ${failure.exitCode}). Nothing was committed.`);
  }
  console.log();
}

export function commitFailed(failure: CommitFailure) {
  commitFailureOutput(failure);
  commitFailureMessage(failure);
}

export function finalSuccess(opts: { count: number; startedAt: number }) {
  const elapsedMs = Date.now() - opts.startedAt;
  const seconds = elapsedMs / 1000;
  const dur = seconds >= 0.1 ? seconds.toFixed(1) + 's' : elapsedMs + 'ms';
  const plural = opts.count !== 1;
  if (plural) console.log(`└ ✨ ${opts.count} commits created in ${dur}.`);
  else console.log(`└ ✨ commit created in ${dur}.`);
  console.log();
}

export function createPhasedSpinner(oraLib: any) {
  const useAnim =
    process.stdout.isTTY && !process.env.AICC_NO_ANIMATION && !process.env.AICC_NO_SPINNER_ANIM;
  const palette = [
    '#3a0d6d',
    '#5a1ea3',
    '#7a32d6',
    '#9a4dff',
    '#b267ff',
    '#c37dff',
    '#b267ff',
    '#9a4dff',
    '#7a32d6',
    '#5a1ea3',
  ];
  let label = 'Starting';
  let i = 0;
  const spinner = oraLib({ text: chalk.bold(label), spinner: 'dots' }).start();
  let interval: any = null;

  function frame() {
    if (!useAnim) return;
    spinner.text = chalk.bold.hex(palette[i])(label);
    i = (i + 1) % palette.length;
  }

  if (useAnim) {
    frame();
    interval = setInterval(frame, 80);
  }

  function setLabel(next: string) {
    label = next;
    if (useAnim) {
      i = 0; // restart cycle for new label
      frame();
    } else {
      spinner.text = chalk.bold(label);
    }
  }

  function stopAnim() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  return {
    spinner,
    async step<T>(l: string, fn: () => Promise<T>): Promise<T> {
      setLabel(l);
      try {
        return await fn();
      } catch (e: any) {
        stopAnim();
        const msg = `${l} failed: ${e?.message || e}`.replace(/^\s+/, '');
        spinner.fail(msg);
        throw e;
      }
    },
    phase(l: string) {
      setLabel(l);
    },
    stop() {
      stopAnim();
      spinner.stop();
    },
  };
}

export function renderCommitBlock(opts: {
  messageLabelColor?: (s: string) => string;
  descriptionLabelColor?: (s: string) => string;
  title: string;
  body?: string;
  indexPrefix?: string; // legacy numeric prefix
  titleColor?: (s: string) => string;
  bodyFirstLineColor?: (s: string) => string;
  bodyLineColor?: (s: string) => string;
  heading?: string; // e.g. "Commit 1"
  fancy?: boolean; // enable fancy frame style
  hideMessageLabel?: boolean;
}) {
  const dim = (s: string) => chalk.dim(s);
  const white = (s: string) => chalk.white(s);
  const msgColor = opts.messageLabelColor || dim;
  const descColor = opts.descriptionLabelColor || dim;
  const titleColor = opts.titleColor || white;
  const bodyFirst = opts.bodyFirstLineColor || white;
  const bodyRest = opts.bodyLineColor || white;

  if (opts.fancy) {
    // Fancy card heading + explicit Title: label for multi-commit mode
    const heading = opts.heading ? chalk.hex('#9a4dff').bold(opts.heading) : undefined;
    if (heading) borderLine(heading);
    borderLine(msgColor('Title:') + ' ' + titleColor(`${opts.indexPrefix || ''}${opts.title}`));
  } else {
    if (opts.heading) borderLine(chalk.bold(opts.heading));
    if (!opts.hideMessageLabel)
      borderLine(msgColor('Message:') + ' ' + titleColor(`${opts.indexPrefix || ''}${opts.title}`));
    else
      borderLine(msgColor('Title:') + ' ' + titleColor(`${opts.indexPrefix || ''}${opts.title}`));
  }
  borderLine();
  if (opts.body) {
    const lines = opts.body.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().length === 0) borderLine();
      else if (i === 0) {
        borderLine(descColor('Description:'));
        borderLine(bodyFirst(line));
      } else borderLine(bodyRest(line));
    });
  }
}
