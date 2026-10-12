import { forVisitor, readConfig } from '@dear-steven/core/config';
import { cookies } from 'next/headers';
import { AccessGate } from '@/components/stage/AccessGate';
import { Stage } from '@/components/stage/Stage';
import { ACCESS_COOKIE, validAccessToken } from '@/server/access';
import { getKnowledgeStatus } from '@/server/status';

export const dynamic = 'force-dynamic';

/**
 * A thin server shell: read the knowledge-base status once, then hand over to the client stage —
 * or, when the operator set an access code this browser hasn't entered, the passcode screen.
 */
export default async function Page() {
  const config = readConfig();
  const code = config.accessCode;
  if (code && !(await validAccessToken(code, (await cookies()).get(ACCESS_COOKIE)?.value))) {
    return <AccessGate />;
  }
  // A visitor's own key lives in their browser, so the first paint is without it; the stage asks
  // again with it straight away.
  return <Stage initialStatus={getKnowledgeStatus(forVisitor(config, null))} />;
}
