/**
 * The guided-setup e2e server (playwright.config.ts, `setup.spec.ts`): test values, not secrets.
 * Paths are relative to the repository root, under the gitignored `data/`; the fixture server
 * deletes them when it starts, so every run begins with nothing set up.
 */
export const E2E_SETUP_TOKEN = 'e2e-setup-token-0123456789abcdefghijklmnop';
export const E2E_SETUP_DB = 'data/e2e-setup.db';
export const E2E_SETUP_ENV_FILE = 'data/e2e-setup.env';
/** Accepted by the key schema; only ever sent to the fake OpenAI the fixture server runs. */
export const E2E_FAKE_OPENAI_KEY = 'sk-e2e-fixture-key-not-a-real-key';
