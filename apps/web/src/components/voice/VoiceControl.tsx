'use client';

import { MicOff01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useReducedMotion } from 'motion/react';
import Magnet from '@/components/vendor/react-bits/Magnet';
import VoicePill from '@/components/vendor/react-bits/VoicePill';
import { useI18n } from '@/i18n/I18nProvider';
import { useIsDesktop } from '@/lib/hooks';
import type { VoiceApi } from '@/lib/voice/useVoice';

/**
 * The microphone. Tap to toggle, hold to talk, slide left to cancel, Esc to stop; M from anywhere.
 * The mic is only opened on that gesture — never on page load — and its level meter is live.
 */
export function VoiceControl({
  voice,
  disabled,
  onUnavailable,
}: {
  voice: VoiceApi;
  disabled: boolean;
  onUnavailable: () => void;
}) {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const { t } = useI18n();

  if (voice.input === 'none') {
    return (
      <button
        type="button"
        onClick={onUnavailable}
        aria-label={t.voice.unavailable}
        title={t.errors.micUnsupported}
        className="grid h-9 w-9 flex-none place-items-center rounded-full text-ivory-2 transition-colors hover:bg-ink-3"
      >
        <HugeiconsIcon icon={MicOff01Icon} size={17} strokeWidth={1.8} />
      </button>
    );
  }

  const blocked = voice.permission === 'denied';
  return (
    <Magnet
      padding={36}
      magnetStrength={6}
      disabled={!desktop || Boolean(reduce)}
      wrapperClassName="flex-none"
    >
      <VoicePill
        ref={voice.pillRef}
        reactive="mic"
        mode="auto"
        size={36}
        // The waveform is drawn on a canvas, which cannot resolve CSS variables: --ember-0 literally.
        accentColor="#e3a857"
        iconColor={blocked ? 'var(--steel)' : 'var(--ivory-1)'}
        background="var(--ink-3)"
        disabled={disabled}
        ariaLabel={blocked ? t.voice.blocked : t.voice.talk}
        onStart={voice.onPillStart}
        onStop={voice.onPillStop}
      />
    </Magnet>
  );
}
