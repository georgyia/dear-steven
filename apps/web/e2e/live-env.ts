import { fileURLToPath } from 'node:url';

/**
 * The live e2e server (playwright.config.ts, `operator-key.spec.ts`): the same build, running on an
 * operator key, so what a browser can fetch from a real deployment can be searched for it. The key
 * is a canary in the right shape, not a secret; the server's OpenAI is the fixture server.
 */
export const E2E_OPERATOR_CANARY = 'sk-proj-e2eCanary7fQ2mX9pL4vR8tK1nB6cJ3hD5sW0yZq';

/**
 * Where `text` gives away any of the canary: the key itself, any eight characters of its secret
 * part in a row (a truncated or partly masked copy), or its last four after a mask, the way a
 * provider error echoes a key. The secret part is random-looking, so none of this turns up in
 * minified code by chance.
 */
export function canaryIn(text: string): string | null {
  const secret = E2E_OPERATOR_CANARY.slice('sk-proj-'.length);
  if (text.includes(E2E_OPERATOR_CANARY)) return E2E_OPERATOR_CANARY;
  for (let i = 0; i + 8 <= secret.length; i++) {
    if (text.includes(secret.slice(i, i + 8))) return secret.slice(i, i + 8);
  }
  const tail = secret.slice(-4);
  return new RegExp(`[*…\\.]${tail}`).test(text) ? `masked …${tail}` : null;
}
/** Everything the live server prints, under the gitignored `data/` at the repository root. */
export const E2E_LIVE_LOG = fileURLToPath(
  new URL('../../../data/e2e-live-server.log', import.meta.url),
);
