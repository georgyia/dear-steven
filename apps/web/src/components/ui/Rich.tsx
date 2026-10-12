import type { ReactNode } from 'react';

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink-3 px-1.5 py-0.5 font-mono text-[12px] text-ivory-1">
      {children}
    </code>
  );
}

/** Catalogue text with `backticked` commands and file names set as code. */
export function Rich({ text }: { text: string }) {
  return text.split('`').map((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed string, never reordered
    i % 2 === 1 ? <Code key={i}>{part}</Code> : part,
  );
}
