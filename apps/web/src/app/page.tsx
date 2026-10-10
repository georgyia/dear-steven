import { Stage } from '@/components/stage/Stage';
import { getKnowledgeStatus } from '@/server/status';

export const dynamic = 'force-dynamic';

/** A thin server shell: read the knowledge-base status once, then hand over to the client stage. */
export default function Page() {
  return <Stage initialStatus={getKnowledgeStatus()} />;
}
