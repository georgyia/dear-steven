import { SetupKeysSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { parseJson, readBody } from '@/server/body';
import { requestUiLocale } from '@/server/locale';
import { NO_STORE, notFound, saveKeys, setupAllowed, setupState } from '@/server/setup';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/**
 * Saves keys and the daily cap to `.env` (P6-04). The answer says which keys are set, never what
 * they are; a refused value is never repeated back.
 */
export async function POST(req: Request) {
  if (!setupAllowed(req)) return notFound();
  const copy = MESSAGES[await requestUiLocale()].serverErrors;
  const raw = await readBody(req, 4096);
  if (raw === null) return jsonError(413, 'bad_request', copy.setupKeysInvalid, NO_STORE);
  const keys = SetupKeysSchema.safeParse(parseJson(raw));
  if (!keys.success) return jsonError(400, 'bad_request', copy.setupKeysInvalid, NO_STORE);
  try {
    saveKeys(keys.data);
  } catch (error) {
    console.error(
      '[setup] could not write the env file:',
      error instanceof Error ? error.name : error,
    );
    return jsonError(500, 'internal', copy.setupWriteFailed, NO_STORE);
  }
  return Response.json(setupState(), { headers: NO_STORE });
}
