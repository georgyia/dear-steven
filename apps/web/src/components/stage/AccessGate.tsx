'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Disclosure } from './Disclosure';
import { HeroWordmark } from './Wordmark';

type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'wrong' | 'slow' | 'offline' };

/**
 * The passcode screen (P6-08), shown instead of the stage when the operator set an access code
 * and this browser hasn't entered it. On success the server sets an HTTP-only cookie and the page
 * reloads into the stage; the code itself is never stored in the browser.
 */
export function AccessGate() {
  const id = useId();
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const { access } = useI18n().t;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || state.kind === 'checking') return;
    setState({ kind: 'checking' });
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setState({ kind: res.status === 429 ? 'slow' : res.status === 401 ? 'wrong' : 'offline' });
    } catch {
      setState({ kind: 'offline' });
    }
  }

  const message =
    state.kind === 'wrong' || state.kind === 'slow' || state.kind === 'offline'
      ? access[state.kind]
      : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-ink-0 px-4 py-16 text-center">
      <HeroWordmark />
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 text-left">
        <label htmlFor={`${id}-code`} className="text-[15px] text-ivory-1">
          {access.prompt}
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-code`}
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={state.kind === 'wrong' || undefined}
            aria-describedby={message ? `${id}-message` : undefined}
            className="min-w-0 flex-1 rounded-full border border-ink-3 bg-ink-1 px-4 py-2.5 text-[15px] text-ivory-0 placeholder:text-steel focus:border-ember-0/60 focus:outline-none"
            placeholder={access.placeholder}
          />
          <button
            type="submit"
            disabled={state.kind === 'checking'}
            className="rounded-full bg-ember-0 px-5 py-2.5 text-[14px] font-medium text-ink-0 transition-colors hover:bg-ember-1 disabled:opacity-60"
          >
            {state.kind === 'checking' ? access.checking : access.enter}
          </button>
        </div>
        <p id={`${id}-message`} role="status" className="min-h-5 text-[13.5px] text-oxblood-1">
          {message}
        </p>
      </form>
      <Disclosure className="max-w-sm text-[13px] leading-relaxed text-ivory-2" />
    </main>
  );
}
