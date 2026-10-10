'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import SwipeToast from '@/components/vendor/react-bits/SwipeToast';

export interface ToastInput {
  /** Re-using an id replaces the toast instead of stacking a duplicate. */
  id?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 0 keeps it until closed. */
  duration?: number;
  tone?: 'neutral' | 'ember' | 'error';
}

interface Entry extends ToastInput {
  id: string;
  open: boolean;
}

interface ToastApi {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const EntriesContext = createContext<{ toasts: Entry[]; remove: (id: string) => void }>({
  toasts: [],
  remove: () => undefined,
});

const FUSE = {
  neutral: 'var(--ivory-2)',
  ember: 'var(--ember-0)',
  error: 'var(--oxblood)',
} as const;

let counter = 0;

/** Toast state. Where toasts appear is decided by whoever renders <ToastViewport>. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Entry[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    counter += 1;
    const id = input.id ?? `toast-${counter}`;
    setToasts((all) => {
      const next: Entry = { ...input, id, open: true };
      return all.some((t) => t.id === id)
        ? all.map((t) => (t.id === id ? next : t))
        : [...all, next].slice(-4);
    });
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const entries = useMemo(() => ({ toasts, remove }), [toasts, remove]);

  return (
    <ToastContext.Provider value={api}>
      <EntriesContext.Provider value={entries}>{children}</EntriesContext.Provider>
    </ToastContext.Provider>
  );
}

/** Renders the stack. `className` positions it (it is always fixed). */
export function ToastViewport({ className }: { className: string }) {
  const { toasts, remove } = useContext(EntriesContext);
  return (
    <section
      aria-label="Notifications"
      className={`pointer-events-none fixed z-50 flex w-[min(380px,calc(100vw-32px))] flex-col items-end transition-[bottom,right] duration-300 ${className}`}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full">
          <SwipeToast
            inline
            open={t.open}
            title={t.title}
            description={t.description}
            actionLabel={t.actionLabel}
            onAction={t.onAction}
            duration={t.duration ?? 3200}
            closeButton={t.duration === 0}
            fuse={t.duration === 0 ? 'none' : 'bottom'}
            background="var(--ink-2)"
            color="var(--ivory-0)"
            fuseColor={FUSE[t.tone ?? 'neutral']}
            width={380}
            radius={16}
            onClose={() => remove(t.id)}
            className="[&_[role=status]]:border [&_[role=status]]:border-ink-3"
          />
        </div>
      ))}
    </section>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
