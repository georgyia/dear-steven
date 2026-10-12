import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font' });
  return { Fraunces: font, Geist: font, Geist_Mono: font };
});
vi.mock('@/server/locale', () => ({ requestUiLocale: async () => 'en' }));
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
