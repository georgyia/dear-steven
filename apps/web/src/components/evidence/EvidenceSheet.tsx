'use client';

import { motion, type PanInfo, useDragControls, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

interface EvidenceSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Mobile bottom sheet (85% of the viewport) on a native modal <dialog>: focus is trapped and the
 * conversation behind is inert, but it stays in place underneath. Drag the handle down to close.
 */
export function EvidenceSheet({ open, onClose, children }: EvidenceSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const { t } = useI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer convenience; Esc closes natively
    <dialog
      ref={ref}
      aria-label={t.inspector.label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto h-[85dvh] max-h-[85dvh] w-full max-w-full overflow-visible bg-transparent p-0 backdrop:bg-[rgb(5_4_3/0.6)]"
    >
      {open ? (
        <motion.div
          className="flex h-full flex-col overflow-hidden rounded-t-[var(--radius-panel)] border-t border-ink-3 bg-ink-1 text-ivory-0"
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          transition={{ type: 'spring', duration: 0.42, bounce: 0 }}
          drag={reduce ? false : 'y'}
          dragListener={false}
          dragControls={drag}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={onDragEnd}
        >
          <div
            className="flex flex-none touch-none justify-center py-2.5"
            onPointerDown={(e) => drag.start(e)}
            aria-hidden="true"
          >
            <span className="h-1 w-10 rounded-full bg-ink-4" />
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </motion.div>
      ) : null}
    </dialog>
  );
}
