'use client';

import { CrashPage } from '@/components/ui/FallbackPage';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * A crash anywhere in the stage (P10-09): what happened in the visitor's words, a retry that
 * renders the page again, and the way home. The error itself is never shown: its message can carry
 * details, and a stack means nothing to a visitor.
 */
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <CrashPage t={useI18n().t} retry={retry} />;
}
