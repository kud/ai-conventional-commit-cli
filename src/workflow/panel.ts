import chalk from 'chalk';

export interface PanelOptions {
  title?: string;
  lines?: string[]; // pre-rendered lines without borders
  width?: number; // optional fixed width
}

export function buildPanel(opts: PanelOptions): string {
  const termWidth = process.stdout.columns || 80;
  const contentLines = opts.lines && opts.lines.length ? opts.lines : [];
  const maxContent = Math.max(
    opts.title ? stripAnsi(opts.title).length : 0,
    ...contentLines.map((l) => stripAnsi(l).length),
  );
  const innerWidth = Math.min(opts.width || maxContent, termWidth - 4); // 2 border chars + 2 padding
  const pad = (s: string) => {
    const visible = stripAnsi(s).length;
    const needed = innerWidth - visible;
    return s + ' '.repeat(Math.max(0, needed));
  };
  const top = '┌ ' + pad(opts.title ? chalk.bold(opts.title) : '') + ' ┐';
  const body = contentLines.map((l) => '│ ' + pad(l) + ' │');
  const bottom = '└' + '─'.repeat(innerWidth + 2) + '┘';
  return [top, ...body, bottom].join('\n');
}

export function renderPanel(opts: PanelOptions) {
  process.stdout.write(buildPanel(opts) + '\n');
}

function stripAnsi(str: string) {
  // minimal ansi stripper for width calc
  return str.replace(/\u001B\[[0-9;]*m/g, '');
}
