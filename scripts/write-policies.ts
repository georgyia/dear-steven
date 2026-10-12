// Writes DISCLAIMER.md, TERMS.md and PRIVACY.md at the repository root from the one source the app
// also renders (apps/web/src/content/policies.ts). `pnpm policies`; a test fails if they drift.
import { writeFileSync } from 'node:fs';
import { POLICIES, policyMarkdown } from '../apps/web/src/content/policies.ts';

for (const policy of POLICIES) {
  writeFileSync(new URL(`../${policy.file}`, import.meta.url), policyMarkdown(policy));
  console.log(`wrote ${policy.file}`);
}
