// `pnpm dev:setup` (P6-04): the web app on this machine only, with the guided setup switched on for
// this run. The link printed below carries a fresh token; without it, every setup route is a 404.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const HOST = '127.0.0.1';
const PORT = process.env.PORT ?? '3000';
const token = randomBytes(32).toString('base64url');

const next = spawn(
  'pnpm',
  ['--filter', '@dear-steven/web', 'exec', 'next', 'dev', '--hostname', HOST, '--port', PORT],
  {
    stdio: 'inherit',
    env: { ...process.env, DEAR_STEVEN_SETUP_TOKEN: token, DEAR_STEVEN_SETUP_HOST: HOST },
  },
);

console.log(
  `\n  Guided setup — open this link on this machine:\n\n    http://${HOST}:${PORT}/#setup=${token}\n\n  It works until you stop the server; the next start prints a new one.\n`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => next.kill(signal));
}
next.on('exit', (code) => process.exit(code ?? 0));
