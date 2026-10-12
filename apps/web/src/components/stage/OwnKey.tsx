'use client';

import { VisitorKeySchema } from '@dear-steven/core/schema';
import { useEffect, useId, useState } from 'react';
import SquishSwitch from '@/components/vendor/react-bits/SquishSwitch';
import { useI18n } from '@/i18n/I18nProvider';
import { testKey } from '@/lib/api';
import { canUseOwnKey, forgetKey, saveKey, storedKey } from '@/lib/visitor-key';

/**
 * "Bring your own key" in the setup panel (P6-03): paste, test (free), use; or forget. The key is
 * only stored once the server has confirmed it works, and the field is cleared straight after.
 */
export function OwnKey({ onChange }: { onChange: () => void }) {
  const id = useId();
  const { t } = useI18n();
  const copy = t.setup.ownKey;
  // Storage is only readable after hydration; until then, nothing is shown as stored.
  const [secure, setSecure] = useState(true);
  /** Whether a key is in use, and where it is kept — never the key itself. */
  const [inUse, setInUse] = useState<{ remembered: boolean } | null>(null);
  const [draft, setDraft] = useState('');
  const [remember, setRemember] = useState(false);
  const [testing, setTesting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setSecure(canUseOwnKey());
    const stored = storedKey();
    setInUse(stored && { remembered: stored.remembered });
  }, []);

  async function use(event: React.FormEvent) {
    event.preventDefault();
    const key = draft.trim();
    if (testing) return;
    if (!VisitorKeySchema.safeParse(key).success) {
      setProblem(t.serverErrors.keyMalformed);
      return;
    }
    setTesting(true);
    setProblem(null);
    try {
      const failure = await testKey(key);
      if (failure) {
        setProblem(failure);
        return;
      }
      if (!saveKey(key, remember)) {
        setProblem(copy.noStorage);
        return;
      }
      setDraft('');
      setInUse({ remembered: remember });
      onChange();
    } catch {
      setProblem(copy.failed);
    } finally {
      setTesting(false);
    }
  }

  function forget() {
    forgetKey();
    setInUse(null);
    onChange();
  }

  if (!secure) return <p className="mt-2 text-[13px] text-ivory-2">{copy.insecure}</p>;

  if (inUse) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p role="status" className="text-[14px] text-ivory-1">
          {copy.using(inUse.remembered)}
        </p>
        <button
          type="button"
          onClick={forget}
          className="rounded-full border border-ink-3 px-3.5 py-1.5 text-[13px] text-ivory-1 transition-colors hover:border-oxblood-1/60 hover:text-ivory-0"
        >
          {copy.forget}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={use} className="mt-3 flex flex-col gap-3">
      <label htmlFor={`${id}-key`} className="text-[14px] text-ivory-1">
        {copy.label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`${id}-key`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-note ${problem ? `${id}-problem` : ''}`.trim()}
          placeholder="sk-…"
          className="min-w-0 flex-[1_1_12rem] rounded-full border border-ink-3 bg-ink-1 px-4 py-2 font-mono text-[14px] text-ivory-0 placeholder:text-steel focus:border-ember-0/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={testing || !draft.trim()}
          className="rounded-full bg-ember-0 px-4 py-2 text-[14px] font-medium text-ink-0 transition-colors hover:bg-ember-1 disabled:opacity-60"
        >
          {testing ? copy.testing : copy.use}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <SquishSwitch
          id={`${id}-remember`}
          checked={remember}
          onChange={setRemember}
          width={40}
          height={24}
          radius={12}
          trackColor="var(--ink-3)"
          trackOnColor="var(--ember-0)"
          thumbColor="var(--ivory-2)"
          thumbOnColor="var(--ink-0)"
          className="flex-none"
        />
        <label htmlFor={`${id}-remember`} className="text-[13.5px] text-ivory-1">
          {copy.remember}
        </label>
      </div>
      <p id={`${id}-problem`} role="alert" className="text-[13.5px] text-oxblood-1 empty:hidden">
        {problem}
      </p>
      <p id={`${id}-note`} className="text-[12.5px] leading-relaxed text-ivory-2">
        {copy.privacy}
      </p>
    </form>
  );
}
