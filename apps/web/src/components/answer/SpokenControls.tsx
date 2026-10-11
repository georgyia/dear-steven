'use client';

import { StopIcon, VolumeHighIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import RubberSegment from '@/components/vendor/react-bits/RubberSegment';
import { useI18n } from '@/i18n/I18nProvider';
import { unlockAudio } from '@/lib/voice/speaker';
import { useVoiceContext } from '@/lib/voice/useVoice';

export type AnswerView = 'written' | 'spoken';

interface SpokenControlsProps {
  turnId: string;
  spoken: string;
  /** The answer's language, so it is read in a voice that speaks it. */
  language: string;
  view: AnswerView;
  onView: (view: AnswerView) => void;
}

/**
 * Listen to the spoken version of an answer, or read it. Playback only ever starts from this
 * click (or the mic press that asked the question), never by itself.
 */
export function SpokenControls({ turnId, spoken, language, view, onView }: SpokenControlsProps) {
  const voice = useVoiceContext();
  const { answer } = useI18n().t;
  if (!spoken.trim()) return null;
  const speaking = voice?.speakingTurnId === turnId;
  const canSpeak = voice !== null && voice.output !== 'none';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {canSpeak ? (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            if (speaking) voice.stopSpeaking();
            else voice.speak(turnId, spoken, language);
          }}
          aria-pressed={speaking}
          className={`relative inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${speaking ? 'border-ember-0/70 text-ember-1' : 'border-ink-3 text-ivory-1 hover:border-ink-4 hover:text-ivory-0'}`}
        >
          {speaking ? (
            <span
              aria-hidden="true"
              className="absolute inset-[-4px] rounded-full border border-ember-0/40 animate-[ds-breathe_1.6s_ease-in-out_infinite] motion-reduce:animate-none"
            />
          ) : null}
          <HugeiconsIcon icon={speaking ? StopIcon : VolumeHighIcon} size={14} strokeWidth={2} />
          {speaking ? answer.stop : answer.listen}
        </button>
      ) : null}
      <RubberSegment
        aria-label={answer.viewLabel}
        items={[
          { value: 'written', label: answer.written },
          { value: 'spoken', label: answer.spoken },
        ]}
        value={view}
        onChange={(v) => onView(v as AnswerView)}
        size="sm"
        trackColor="var(--ink-2)"
        thumbColor="var(--ink-4)"
        textColor="var(--ivory-2)"
        activeTextColor="var(--ivory-0)"
        radius={999}
      />
    </div>
  );
}
