'use client';

import { DEFAULT_STOCK_VOICE, STOCK_VOICES, type StockVoice } from '@dear-steven/core/schema';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import SquishSwitch from '@/components/vendor/react-bits/SquishSwitch';
import type { VoicePreferences } from '@/lib/voice/preferences';
import type { VoiceApi } from '@/lib/voice/useVoice';

interface VoiceSettingsProps {
  open: boolean;
  onClose: () => void;
  prefs: VoicePreferences;
  update: (patch: Partial<VoicePreferences>) => void;
  /** False once a save failed: settings then last only for this tab. */
  persisted: boolean;
  voice: VoiceApi;
}

const SAMPLE = 'This is how I’ll sound when I answer you.';
const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** Voice settings (P5-07): always speak, on-device recognition, and a stock-voice picker. */
export function VoiceSettings({
  open,
  onClose,
  prefs,
  update,
  persisted,
  voice,
}: VoiceSettingsProps) {
  const [installing, setInstalling] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  const { checkOnDevice } = voice;
  useEffect(() => {
    if (open) checkOnDevice();
  }, [open, checkOnDevice]);

  const toggleOnDevice = async (next: boolean) => {
    setInstallFailed(false);
    if (!next || voice.onDevice === 'available') return update({ onDevice: next });
    setInstalling(true);
    const ok = await voice.installOnDevice();
    setInstalling(false);
    if (ok) update({ onDevice: true });
    else setInstallFailed(true);
  };

  const onDeviceUsable =
    voice.input === 'browser' &&
    (voice.onDevice === 'available' || voice.onDevice === 'downloadable');
  const onDeviceNote =
    voice.input !== 'browser'
      ? 'This browser has no built-in speech recognition, so your voice is transcribed on the server instead.'
      : installing
        ? 'Downloading the speech model…'
        : installFailed
          ? 'The speech model didn’t finish downloading. Try again later.'
          : voice.onDevice === 'available'
            ? 'Recognise your voice on this device, so the audio never leaves it.'
            : voice.onDevice === 'downloadable'
              ? 'Chrome downloads a speech model once, then recognises your voice on this device.'
              : voice.onDevice === 'unknown'
                ? 'Checking what this browser can do…'
                : 'Not available in this browser — it uses its own speech service.';

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Settings" title="Voice">
      <div className="flex flex-col divide-y divide-ink-3">
        <SettingRow
          title="Always speak replies"
          note="Read every answer aloud, typed or spoken. Nothing plays until you’ve asked something during this visit."
        >
          {(ids) => (
            <SquishSwitch
              id={ids.control}
              ariaDescribedBy={ids.note}
              checked={prefs.alwaysSpeak}
              onChange={(next) => update({ alwaysSpeak: next })}
              {...SWITCH_COLOURS}
            />
          )}
        </SettingRow>
        <SettingRow title="On-device speech recognition" note={onDeviceNote}>
          {(ids) => (
            <SquishSwitch
              id={ids.control}
              ariaDescribedBy={ids.note}
              checked={prefs.onDevice && voice.onDevice === 'available'}
              disabled={!onDeviceUsable || installing}
              onChange={(next) => void toggleOnDevice(next)}
              {...SWITCH_COLOURS}
            />
          )}
        </SettingRow>
        <VoicePicker prefs={prefs} update={update} voice={voice} />
      </div>
      {persisted ? null : (
        <p className="mt-4 text-[12.5px] leading-relaxed text-oxblood-1">
          This browser isn’t letting me save settings, so these last until you close the tab.
        </p>
      )}
    </Dialog>
  );
}

const SWITCH_COLOURS = {
  width: 48,
  height: 28,
  radius: 14,
  trackColor: 'var(--ink-3)',
  trackOnColor: 'var(--ember-0)',
  thumbColor: 'var(--ivory-2)',
  thumbOnColor: 'var(--ink-0)',
};

function SettingRow({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: (ids: { control: string; note: string }) => ReactNode;
}) {
  const control = useId();
  const noteId = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0">
      <div className="min-w-0">
        <label htmlFor={control} className="text-[15px] text-ivory-0">
          {title}
        </label>
        <p id={noteId} className="mt-1 text-[13px] leading-relaxed text-ivory-2" aria-live="polite">
          {note}
        </p>
      </div>
      <div className="flex-none pt-0.5">{children({ control, note: noteId })}</div>
    </div>
  );
}

function useSystemVoices(enabled: boolean): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener('voiceschanged', read);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read);
  }, [enabled]);
  return voices;
}

function VoicePicker({
  prefs,
  update,
  voice,
}: Pick<VoiceSettingsProps, 'prefs' | 'update' | 'voice'>) {
  const selectId = useId();
  const noteId = useId();
  const system = useSystemVoices(voice.output === 'browser');
  const english = system
    .filter((v) => v.lang.toLowerCase().startsWith('en') || v.voiceURI === prefs.browserVoice)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (voice.output === 'none') {
    return (
      <div className="py-4">
        <p className="text-[15px] text-ivory-0">Voice</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ivory-2">
          This browser can’t speak replies aloud.
        </p>
      </div>
    );
  }

  const select =
    'h-10 w-full max-w-xs rounded-[12px] border border-ink-3 bg-ink-2 px-3 text-[14px] text-ivory-0 transition-colors hover:border-ink-4';

  return (
    <div className="flex flex-col gap-2 py-4 last:pb-0">
      <label htmlFor={selectId} className="text-[15px] text-ivory-0">
        Voice
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {voice.output === 'server' ? (
          <select
            id={selectId}
            aria-describedby={noteId}
            value={prefs.serverVoice ?? DEFAULT_STOCK_VOICE}
            onChange={(e) => {
              const v = e.target.value as StockVoice;
              update({ serverVoice: v === DEFAULT_STOCK_VOICE ? null : v });
            }}
            className={select}
          >
            {STOCK_VOICES.map((v) => (
              <option key={v} value={v}>
                {titleCase(v)}
                {v === DEFAULT_STOCK_VOICE ? ' (default)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={selectId}
            aria-describedby={noteId}
            value={prefs.browserVoice ?? ''}
            onChange={(e) => update({ browserVoice: e.target.value || null })}
            className={select}
          >
            <option value="">Automatic</option>
            {english.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => voice.preview(SAMPLE)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-3 px-3.5 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:bg-ink-2 hover:text-ivory-0"
        >
          <HugeiconsIcon icon={VolumeHighIcon} size={15} strokeWidth={1.8} />
          Hear it
        </button>
      </div>
      <p id={noteId} className="text-[13px] leading-relaxed text-ivory-2">
        {voice.output === 'server'
          ? 'Stock OpenAI voices only — never an imitation of a real person.'
          : 'Your device’s own voices. With an OpenAI key, stock OpenAI voices are offered instead.'}
      </p>
    </div>
  );
}
