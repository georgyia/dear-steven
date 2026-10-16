import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashPage } from '@/components/ui/FallbackPage';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';

const locale = vi.hoisted(() => ({ current: 'en' as 'en' | 'de' }));

vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font' });
  return { Fraunces: font, Geist: font, Geist_Mono: font };
});
vi.mock('@/server/locale', () => ({ requestUiLocale: async () => locale.current }));
vi.mock('@/styles/globals.css', () => ({}));

/** What a crash can carry: a message naming internals, a digest, a stack. None may reach the page. */
const crash = Object.assign(new Error('SQLITE_CORRUPT at /srv/data/dear-steven.db'), {
  digest: '2718281828',
});
const leaks = [crash.message, crash.digest, crash.stack?.split('\n')[1]?.trim() ?? 'at '];

/** The first element in a tree (without rendering components) that `match` accepts. */
function find(
  node: ReactNode,
  match: (props: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, match);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (match(node.props)) return node.props;
  return find(node.props.children as ReactNode, match);
}

beforeEach(() => {
  locale.current = 'en';
});

describe('the error page (P10-09)', () => {
  it('says what happened and offers the ways on, never the error itself', async () => {
    const { default: ErrorPage } = await import('./error');
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: crash, retry: vi.fn() }));
    expect(html).toContain(en.fallback.crash.title);
    expect(html).toContain(`>${en.turn.retry}</button>`);
    expect(html).toContain('href="/"');
    for (const leak of leaks) expect(html).not.toContain(leak);
  });

  it('retries the page when asked', () => {
    const retry = vi.fn();
    const button = find(CrashPage({ t: en, retry }), (props) => props.type === 'button');
    expect(button?.children).toBe(en.turn.retry);
    const press = button?.onClick as () => void;
    press();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('brings its own document when the root layout itself fails', async () => {
    const { default: GlobalError } = await import('./global-error');
    const html = renderToStaticMarkup(createElement(GlobalError, { error: crash, retry: vi.fn() }));
    expect(html).toMatch(/^<html lang="en"[^>]*>/);
    expect(html).toContain('<body>');
    expect(html).toContain(en.fallback.crash.title);
    for (const leak of leaks) expect(html).not.toContain(leak);
  });
});

describe('the not-found page (P10-09)', () => {
  it('leads home, in the visitor’s language', async () => {
    const { default: NotFound, generateMetadata } = await import('./not-found');
    const english = renderToStaticMarkup(await NotFound());
    expect(english).toContain(en.fallback.notFound.title);
    expect(english).toMatch(/<a href="\/"[^>]*>Ask me something<\/a>/);
    expect(await generateMetadata()).toEqual({ title: 'Page not found: Dear Steven' });

    locale.current = 'de';
    const german = renderToStaticMarkup(await NotFound());
    expect(german).toContain(de.fallback.notFound.title);
    expect(german).toContain(de.disclosure);
  });
});
