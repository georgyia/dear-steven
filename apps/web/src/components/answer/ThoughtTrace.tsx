'use client';

import ThoughtLine from '@/components/vendor/react-bits/ThoughtLine';
import { useI18n } from '@/i18n/I18nProvider';
import type { Turn } from '@/lib/conversation';

/**
 * The visible thinking: each server status becomes a step (searching → found → composing), and
 * the line settles to "Thought for 3.1s" when the answer is complete.
 */
export function ThoughtTrace({ turn }: { turn: Turn }) {
  const { thinking } = useI18n().t;
  const working = turn.status === 'streaming';
  const steps = turn.steps.map((s) => s.message);
  const label = steps[steps.length - 1] ?? thinking.searching(0);
  return (
    <ThoughtLine
      label={label}
      steps={steps}
      working={working}
      doneLabel={
        turn.status === 'stopped'
          ? thinking.stopped
          : turn.status === 'error'
            ? thinking.interrupted
            : thinking.done
      }
      elapsed={working || turn.elapsedMs === null ? undefined : turn.elapsedMs / 1000}
      formatElapsed={thinking.elapsed}
      formatElapsedSpoken={thinking.elapsedSpoken}
      glyph="dot"
      color="var(--ivory-2)"
      glyphColor="var(--ember-0)"
      fontSize={14}
      collapseOnSettle
      className="font-sans"
    />
  );
}
