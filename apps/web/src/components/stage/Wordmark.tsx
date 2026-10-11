'use client';

import { brand } from '@/brand';
import BlurText from '@/components/vendor/react-bits/BlurText';
import { useI18n } from '@/i18n/I18nProvider';

/** The hero wordmark resolves out of blur, word by word. */
export function HeroWordmark() {
  return (
    <BlurText
      as="h1"
      text={brand.name}
      delay={140}
      stepDuration={0.42}
      direction="bottom"
      className="justify-center font-display text-[64px] leading-[0.95] tracking-[-0.025em] text-ivory-0 sm:text-[96px] [font-variation-settings:'opsz'_144,'SOFT'_100]"
    />
  );
}

/** Compact wordmark for the conversation top bar; doubles as "new conversation". */
export function CompactWordmark({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t.stage.newConversation}
      className="rounded-md font-display text-[20px] whitespace-nowrap tracking-[-0.01em] text-ivory-0 transition-colors hover:text-ember-1 [font-variation-settings:'opsz'_48,'SOFT'_100]"
    >
      {brand.name}
      <span className="sr-only">{t.stage.newConversationSr}</span>
    </button>
  );
}
