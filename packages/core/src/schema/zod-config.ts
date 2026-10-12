import { config } from 'zod';

/**
 * zod compiles object parsers with `new Function` where it can, and finds out by trying once. The
 * page's Content-Security-Policy has no 'unsafe-eval' (P6-09), so in the browser that probe is
 * refused and reported as a violation on every visit. Parsing behaves identically without it, and
 * the schemas here are small, so the speed-up isn't worth an exception in the policy.
 */
config({ jitless: true });
