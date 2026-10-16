import type { Metadata } from 'next';
import { brand } from '@/brand';
import { NotFoundPage } from '@/components/ui/FallbackPage';
import { MESSAGES } from '@/i18n';
import { requestUiLocale } from '@/server/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { fallback } = MESSAGES[await requestUiLocale()];
  return { title: `${fallback.notFound.eyebrow}: ${brand.name}` };
}

/** Any address the app doesn't know (P10-09): a 404 in the product's own design, with the way home. */
export default async function NotFound() {
  return <NotFoundPage t={MESSAGES[await requestUiLocale()]} />;
}
