import { fileURLToPath } from 'node:url';

/**
 * The free-questions e2e server (playwright.config.ts, `free-questions.spec.ts`, P8-02): the same
 * build on an operator key with `DEAR_STEVEN_FREE_QUESTIONS=3`, a fixture knowledge base and the
 * fixture server's fake OpenAI. Test values, not secrets. Everything it writes (the knowledge base,
 * the free-question ledger and its secret) is in its own folder under the gitignored `data/`,
 * removed before every run.
 */
export const E2E_FREE_DIR = fileURLToPath(new URL('../../../data/e2e-free/', import.meta.url));
export const E2E_FREE_DB = `${E2E_FREE_DIR}kb.db`;
export const E2E_FREE_OPERATOR_KEY = 'sk-e2e-free-operator-key-not-a-real-key';
export const E2E_FREE_VISITOR_KEY = 'sk-e2e-free-visitor-key-not-a-real-key';
