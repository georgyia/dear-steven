/** Terminal output for the CLI: progress lines, tables and a little colour when it is a TTY. */

const tty = process.stdout.isTTY === true && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: paint('2'),
  bold: paint('1'),
  ember: paint('38;5;179'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
};

export function progress(total: number, label: string) {
  let done = 0;
  let failed = 0;
  const started = Date.now();
  const render = (current: string) => {
    const pct = total ? Math.round((done / total) * 100) : 100;
    const width = 24;
    const filled = Math.round((pct / 100) * width);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
    const line = `${c.ember(bar)} ${String(done).padStart(String(total).length)}/${total} ${label}${failed ? c.red(` · ${failed} failed`) : ''} ${c.dim(current.slice(0, 50))}`;
    if (tty) process.stdout.write(`\r\x1b[2K${line}`);
  };
  return {
    tick(current: string, ok = true) {
      done += 1;
      if (!ok) failed += 1;
      if (tty) render(current);
      else console.log(`${ok ? '✓' : '✗'} [${done}/${total}] ${current}`);
    },
    note(current: string) {
      if (tty) render(current);
    },
    end() {
      if (tty) process.stdout.write('\r\x1b[2K');
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `${label}: ${done - failed} done${failed ? c.red(`, ${failed} failed`) : ''} in ${secs}s`,
      );
      return { done, failed };
    },
  };
}

export function table(rows: (string | number)[][], header: string[]) {
  const all = [header, ...rows.map((r) => r.map(String))];
  const widths = header.map((_, i) => Math.max(...all.map((r) => [...(r[i] ?? '')].length)));
  const fmt = (r: string[]) => r.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');
  console.log(c.bold(fmt(header)));
  for (const r of all.slice(1)) console.log(fmt(r));
}

export const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
