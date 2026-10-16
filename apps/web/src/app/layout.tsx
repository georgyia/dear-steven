import { readConfig } from '@dear-steven/core/config';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { brand } from '@/brand';
import { MESSAGES } from '@/i18n';
import { I18nProvider } from '@/i18n/I18nProvider';
import { requestUiLocale } from '@/server/locale';
import { fontVariables } from './fonts';
import '@/styles/globals.css';

// Every page, the 404 included, is rendered per request: its scripts need that response's CSP
// nonce (src/proxy.ts, P6-09). A prerendered page would carry none and its scripts would be refused.
export const dynamic = 'force-dynamic';

/**
 * The page's title and description, and what a link preview shows (P10-10): an unofficial AI
 * persona, in the visitor's language, with the icon from `icon.svg` and `apple-icon.tsx`. No preview
 * image, so no likeness. Absolute links only from `DEAR_STEVEN_PUBLIC_URL`. Search engines stay out
 * (`noindex`) until the owner decides otherwise.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestUiLocale();
  const { meta } = MESSAGES[locale];
  const { publicUrl } = readConfig();
  return {
    ...(publicUrl ? { metadataBase: new URL(publicUrl) } : {}),
    title: brand.name,
    description: meta.description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: meta.previewTitle,
      description: meta.description,
      locale: locale === 'de' ? 'de_DE' : 'en_GB',
    },
    twitter: { card: 'summary', title: meta.previewTitle, description: meta.description },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0908',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await requestUiLocale();
  // Browser extensions (Grammarly, Dark Reader, password managers) add attributes to <html> and
  // <body> before React hydrates. suppressHydrationWarning covers these two elements' own
  // attributes only, so a real mismatch anywhere inside the page is still reported (P7-01).
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
