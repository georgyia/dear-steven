'use client';

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  width?: 'md' | 'lg';
}

/**
 * Modal built on the native <dialog>: the browser provides the focus trap, Esc-to-close, inert
 * background and top-layer stacking. Clicking the backdrop closes it. `onClose` is called only for
 * user-initiated closes (Esc, backdrop, the close button) — never for the native `close` event, which
 * also fires when `open` turns false, so one dialog can hand over to another.
 */
export function Dialog({ open, onClose, title, eyebrow, children, width = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer convenience; Esc closes natively
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[min(88dvh,760px)] w-[calc(100vw-32px)] overflow-hidden rounded-[var(--radius-panel)] border border-ink-3 bg-ink-1 p-0 text-ivory-0 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)] backdrop:bg-[rgb(5_4_3/0.72)] backdrop:backdrop-blur-[3px] open:animate-[ds-dialog-in_220ms_var(--ease-out)] ${width === 'lg' ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-ink-3 px-6 pt-5 pb-4">
          <div>
            {eyebrow ? (
              <p className="font-mono text-[11px] tracking-[0.14em] text-steel uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2 id={titleId} className="mt-1 font-display text-[26px] leading-tight text-ivory-0">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-9 w-9 flex-none place-items-center rounded-full text-ivory-2 transition-colors hover:bg-ink-3 hover:text-ivory-0"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
          </button>
        </header>
        <section
          aria-labelledby={titleId}
          // Focusable so keyboard users can scroll long content (WCAG 2.1.1, axe scrollable-region-focusable).
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
          tabIndex={0}
          className="overflow-y-auto px-6 py-5"
        >
          {children}
        </section>
      </div>
    </dialog>
  );
}
