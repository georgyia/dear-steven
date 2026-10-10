'use client';

import { StopIcon, VolumeHighIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import RubberSegment from '@/components/vendor/react-bits/RubberSegment';
import { unlockAudio } from '@/lib/voice/speaker';
import { useVoiceContext } from '@/lib/voice/useVoice';

export type AnswerView = 'written' | 'spoken';

interface SpokenControlsProps {
  turnId: string;
  spoken: string;
  view: AnswerView;
  onView: (view: AnswerView) => void;
}

/**
 * Listen to the spoken version of an answer, or read it. Playback only ever starts from this
 * click (or the mic press that asked the question), never by itself.
 */
export function SpokenControls({ turnId, spoken, view, onView }: SpokenControlsProps) {
  const voice = useVoiceContext();
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
            else voice.speak(turnId, spoken);
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
          {speaking ? 'Stop' : 'Listen'}
        </button>
      ) : null}
      <RubberSegment
        aria-label="Answer view"
        items={[
          { value: 'written', label: 'Written' },
          { value: 'spoken', label: 'Spoken' },
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
