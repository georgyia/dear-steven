import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font' });
  return { Fraunces: font, Geist: font, Geist_Mono: font };
});
const page = vi.hoisted(() => ({ locale: 'en' as 'en' | 'de' }));
vi.mock('@/server/locale', () => ({ requestUiLocale: async () => page.locale }));
vi.mock('@/styles/globals.css', () => ({}));

type Element = ReactElement<{ suppressHydrationWarning?: boolean; children?: unknown }>;

describe('RootLayout (P7-01)', () => {
  it('tolerates extension-added attributes on <html> and <body>, and nowhere else', async () => {
    const { default: RootLayout } = await import('./layout');
    const html = (await RootLayout({ children: null })) as Element;
    expect(html.type).toBe('html');
    expect(html.props.suppressHydrationWarning).toBe(true);
    const body = html.props.children as Element;
    expect(body.type).toBe('body');
    expect(body.props.suppressHydrationWarning).toBe(true);
    const inside = body.props.children as Element;
    expect(inside.props.suppressHydrationWarning).toBeUndefined();
  });
});

describe('generateMetadata (P10-10)', () => {
  afterEach(() => {
    page.locale = 'en';
    vi.unstubAllEnvs();
  });

  const metadata = async () => (await import('./layout')).generateMetadata();

  it('previews as an unofficial AI persona, with no image and no absolute link by default', async () => {
    vi.stubEnv('DEAR_STEVEN_PUBLIC_URL', '');
    const m = await metadata();
    expect(m.metadataBase).toBeUndefined();
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.openGraph).toMatchObject({ type: 'website', siteName: 'Dear Steven' });
    expect(m.twitter).toMatchObject({ card: 'summary' });
    const said = [m.openGraph?.title, m.openGraph?.description, m.twitter?.title].join(' ');
    expect(said).toMatch(/unofficial/);
    expect(said).toMatch(/\bAI\b/);
    expect(JSON.stringify(m)).not.toMatch(/"images"|https?:\/\//);
  });

  it('says so in German too', async () => {
    page.locale = 'de';
    const m = await metadata();
    const said = [m.openGraph?.title, m.openGraph?.description, m.twitter?.title].join(' ');
    expect(said).toMatch(/inoffizielle/);
    expect(said).toMatch(/\bKI\b/);
    expect(m.openGraph).toMatchObject({ locale: 'de_DE' });
  });

  it('makes links absolute only from a valid public URL', async () => {
    vi.stubEnv('DEAR_STEVEN_PUBLIC_URL', 'https://steven.example/somewhere');
    expect(String((await metadata()).metadataBase)).toBe('https://steven.example/');
    vi.stubEnv('DEAR_STEVEN_PUBLIC_URL', 'http://steven.example');
    expect((await metadata()).metadataBase).toBeUndefined();
  });
});
