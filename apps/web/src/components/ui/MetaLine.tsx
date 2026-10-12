import type { ReactNode } from 'react';

/**
 * A line of small facts about something (date, time, who), separated by space rather than by
 * punctuation (P7-02): the gap carries the separation, so nothing reads like a generated list.
 */
export function MetaLine({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {items.filter(Boolean).map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered set of facts
        <span key={i}>{item}</span>
      ))}
    </span>
  );
}
