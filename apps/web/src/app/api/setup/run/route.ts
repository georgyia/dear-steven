import { readConfig } from '@dear-steven/core/config';
import { SetupRunSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { requestUiLocale } from '@/server/locale';
import {
  NO_STORE,
  notFound,
  runningStage,
  setupAllowed,
  setupState,
  smallJson,
  stageResponse,
} from '@/server/setup';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const usd = (x: number) => `$${x.toFixed(x < 1 ? 3 : 2)}`;

/**
 * Runs one ingest stage (P6-04) and streams its progress. One at a time. Embedding is the paid
 * stage: it runs only with a budget the current estimate fits under, which the CLI enforces again.
 */
export async function POST(req: Request) {
  if (!setupAllowed(req)) return notFound();
  const copy = MESSAGES[await requestUiLocale()].serverErrors;
  const run = SetupRunSchema.safeParse(await smallJson(req, 1024));
  if (!run.success) return jsonError(400, 'bad_request', copy.setupBadStage, NO_STORE);
  if (runningStage()) return jsonError(409, 'bad_request', copy.setupBusy, NO_STORE);

  const config = readConfig();
  const { stage, budgetUsd } = run.data;
  if (stage === 'index') {
    if (!config.openaiApiKey) return jsonError(400, 'bad_request', copy.setupNeedsOpenAI, NO_STORE);
    const { usd: estimate } = setupState(config).embedding;
    if (budgetUsd === undefined || estimate > budgetUsd) {
      const message = copy.setupOverBudget(usd(estimate), usd(budgetUsd ?? 0));
      return jsonError(400, 'bad_request', message, NO_STORE);
    }
  }
  if (stage === 'match-youtube' && !config.youtubeApiKey) {
    return jsonError(400, 'bad_request', copy.setupNeedsYouTube, NO_STORE);
  }
  return stageResponse(run.data, req.signal);
}
