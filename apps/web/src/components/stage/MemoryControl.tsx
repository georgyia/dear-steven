'use client';

import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useId, useState } from 'react';
import FuseButton, { type FusePhase } from '@/components/vendor/react-bits/FuseButton';
import SquishSwitch from '@/components/vendor/react-bits/SquishSwitch';

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

  const text = !supported
    ? 'This browser isn’t letting me store anything, so this conversation can’t be remembered.'
    : saveFailed
      ? 'I couldn’t save to this browser’s storage just now. Nothing new is kept.'
      : remember
        ? 'Kept in this browser’s own storage, on this device only, until you forget it. Never sent anywhere.'
        : phase === 'armed'
          ? 'Forgotten — nothing from this conversation is stored on this device.'
          : 'Off: nothing is kept once you close this tab.';

  return (
    <section aria-label="Conversation memory" className="border-t border-ink-3 pt-5">
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
            Remember this conversation on this device
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
                label="Forget"
                undoLabel="Undo"
                doneLabel="Forgotten"
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
