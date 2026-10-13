'use client';

import RubberSegment from '@/components/vendor/react-bits/RubberSegment';
import { useI18n } from '@/i18n/I18nProvider';
import type { StageMode } from '@/lib/mode';

interface ModeSwitchProps {
  mode: StageMode;
  onChange: (mode: StageMode) => void;
}

/**
 * How Dear Steven replies (P7-05), by the composer: a considered answer, talk, or an interview of
 * the visitor (P7-06). Switching keeps everything: the conversation and an interview in progress.
 */
export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 px-1">
      <RubberSegment
        aria-label={t.modes.label}
        items={[
          { value: 'ask', label: t.modes.ask },
          { value: 'talk', label: t.modes.talk },
          { value: 'interview', label: t.modes.interview },
        ]}
        value={mode}
        onChange={(v) => onChange(v as StageMode)}
        size="sm"
        trackColor="var(--ink-1)"
        thumbColor="var(--ink-3)"
        textColor="var(--ivory-2)"
        activeTextColor="var(--ivory-0)"
        radius={999}
      />
      <p className="hidden min-w-0 truncate text-left text-[12.5px] text-ivory-2 sm:block">
        {t.modes.hint[mode]}
      </p>
    </div>
  );
}
