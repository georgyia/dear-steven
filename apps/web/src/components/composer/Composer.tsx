'use client';

import { LIMITS } from '@dear-steven/core/limits';
import type { ReactNode, Ref } from 'react';
import PromptBar from '@/components/vendor/react-bits/PromptBar';

interface ComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
  /** The microphone, when voice is available. */
  voice?: ReactNode;
  inputRef?: Ref<HTMLTextAreaElement>;
}

/**
 * The single conversational input. Send charges to ivory when there is something to say and
 * morphs into a stop square while an answer streams.
 */
export function Composer({
  value,
  onValueChange,
  onSend,
  onStop,
  busy,
  placeholder,
  voice,
  inputRef,
}: ComposerProps) {
  return (
    <div className="composer-shell w-full rounded-[var(--radius-field)] border border-ink-3 bg-ink-2 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.85)] transition-shadow duration-300">
      <PromptBar
        id="composer"
        ariaLabel="Ask Steven"
        value={value}
        onValueChange={onValueChange}
        onSend={onSend}
        onStop={onStop}
        busy={busy}
        placeholder={placeholder}
        maxLength={LIMITS.questionChars}
        trailing={voice}
        inputRef={inputRef}
        background="var(--ink-2)"
        color="var(--ivory-0)"
        width={760}
        radius={22}
        className="w-full"
      />
    </div>
  );
}
