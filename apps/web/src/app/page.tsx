import { readConfig } from '@dear-steven/core/config';
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
  const code = readConfig().accessCode;
  if (code && !(await validAccessToken(code, (await cookies()).get(ACCESS_COOKIE)?.value))) {
    return <AccessGate />;
  }
  return <Stage initialStatus={getKnowledgeStatus()} />;
}
