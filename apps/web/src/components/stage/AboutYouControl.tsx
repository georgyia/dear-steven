'use client';

import { LIMITS } from '@dear-steven/core/limits';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useState } from 'react';
import FuseButton, { type FusePhase } from '@/components/vendor/react-bits/FuseButton';
import { useI18n } from '@/i18n/I18nProvider';

interface AboutYouControlProps {
  /** Exactly what is kept, and sent with questions. */
  text: string;
  failed: boolean;
  demo: boolean;
  onKeep: (text: string) => Promise<boolean>;
  onForget: () => void;
}

/**
 * What Dear Steven keeps about you (P7-08), next to the conversation memory: shown exactly as it
 * is sent, editable, and forgotten at once (with a few seconds to undo).
 */
export function AboutYouControl({ text, failed, demo, onKeep, onForget }: AboutYouControlProps) {
  const field = useId();
  const note = useId();
  const { aboutYou: copy } = useI18n().t;
  const [draft, setDraft] = useState(text);
  const [phase, setPhase] = useState<FusePhase>('idle');
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(text), [text]);

  const changed = draft.trim() !== text;
  const forgotten = phase === 'armed';
  return (
    <section aria-label={copy.label} className="border-t border-ink-3 pt-5">
      <label htmlFor={field} className="text-[14px] text-ivory-1">
        {copy.title}
      </label>
      <p id={note} className="mt-1 text-[12.5px] leading-relaxed text-ivory-2">
        {copy.note}
        {demo ? ` ${copy.demoNote}` : ''}
      </p>
      <textarea
        id={field}
        aria-describedby={note}
        value={forgotten ? '' : draft}
        disabled={forgotten}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        maxLength={LIMITS.aboutChars}
        rows={3}
        className="mt-3 w-full resize-y rounded-2xl border border-ink-3 bg-ink-1 px-4 py-3 text-[14px] leading-relaxed text-ivory-0 focus:border-ember-0/60 focus:outline-none disabled:opacity-50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-steel">
          {copy.counter(draft.length, LIMITS.aboutChars)}
        </span>
        {changed && !forgotten ? (
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={() => void onKeep(draft).then(setSaved)}
            className="rounded-full border border-ink-3 px-3 py-1 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0 disabled:opacity-50"
          >
            {copy.save}
          </button>
        ) : null}
        <FuseButton
          label={copy.forget}
          undoLabel={copy.undo}
          doneLabel={copy.done}
          icon={<HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />}
          size="sm"
          radius={18}
          undoWindow={5000}
          color="var(--ivory-1)"
          background="var(--ink-2)"
          fuseColor="var(--ember-0)"
          commitOn="press"
          onCommit={onForget}
          onUndo={() => void onKeep(text)}
          onPhaseChange={setPhase}
        />
      </div>
      <p aria-live="polite" className="mt-2 text-[12.5px] text-ivory-2 empty:hidden">
        {failed ? copy.failed : forgotten ? copy.forgotten : saved ? copy.saved : ''}
      </p>
    </section>
  );
}
