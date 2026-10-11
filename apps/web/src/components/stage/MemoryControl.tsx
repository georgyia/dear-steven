'use client';

import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useId, useState } from 'react';
import FuseButton, { type FusePhase } from '@/components/vendor/react-bits/FuseButton';
import SquishSwitch from '@/components/vendor/react-bits/SquishSwitch';
import { useI18n } from '@/i18n/I18nProvider';

interface MemoryControlProps {
  remember: boolean;
  supported: boolean;
  saveFailed: boolean;
  onChange: (on: boolean) => void;
  onForget: () => void;
  onUndo: () => void;
}

/**
 * "Remember this conversation on this device" (P5-11), at the end of the conversation. Says where
 * it is kept; Forget deletes at once and offers a few seconds to undo.
 */
export function MemoryControl({
  remember,
  supported,
  saveFailed,
  onChange,
  onForget,
  onUndo,
}: MemoryControlProps) {
  const control = useId();
  const note = useId();
  const [phase, setPhase] = useState<FusePhase>('idle');
  const { memory } = useI18n().t;

  const text = !supported
    ? memory.unsupported
    : saveFailed
      ? memory.saveFailed
      : remember
        ? memory.on
        : phase === 'armed'
          ? memory.forgotten
          : memory.off;

  return (
    <section aria-label={memory.label} className="border-t border-ink-3 pt-5">
      <div className="flex items-start gap-4">
        <SquishSwitch
          id={control}
          ariaDescribedBy={note}
          checked={remember}
          disabled={!supported || phase === 'armed'}
          onChange={onChange}
          width={48}
          height={28}
          radius={14}
          trackColor="var(--ink-3)"
          trackOnColor="var(--ember-0)"
          thumbColor="var(--ivory-2)"
          thumbOnColor="var(--ink-0)"
          className="flex-none"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <label htmlFor={control} className="text-[14px] text-ivory-1">
            {memory.remember}
          </label>
          <p
            id={note}
            aria-live="polite"
            className="mt-1 text-[12.5px] leading-relaxed text-ivory-2"
          >
            {text}
          </p>
          {remember || phase === 'armed' ? (
            <div className="mt-3">
              <FuseButton
                label={memory.forget}
                undoLabel={memory.undo}
                doneLabel={memory.done}
                icon={<HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />}
                size="sm"
                radius={18}
                undoWindow={5000}
                color="var(--ivory-1)"
                background="var(--ink-2)"
                fuseColor="var(--ember-0)"
                commitOn="press"
                onCommit={onForget}
                onUndo={onUndo}
                onPhaseChange={setPhase}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
