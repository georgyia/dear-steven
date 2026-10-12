'use client';

import { isUiLocale, UI_LOCALES } from '@dear-steven/core/copy';
import { DEFAULT_STOCK_VOICE, STOCK_VOICES, type StockVoice } from '@dear-steven/core/schema';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import SquishSwitch from '@/components/vendor/react-bits/SquishSwitch';
import { LOCALE_NAMES } from '@/i18n';
import { useI18n } from '@/i18n/I18nProvider';
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

const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/**
 * Voice and language settings (P5-07, P6-02): the interface language, always speak, on-device
 * recognition, and a voice picker.
 */
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
  const { t } = useI18n();
  const copy = t.voice;
  const notes = copy.onDeviceNotes;
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
      ? notes.server
      : installing
        ? notes.installing
        : installFailed
          ? notes.failed
          : notes[voice.onDevice];

  return (
    <Dialog open={open} onClose={onClose} eyebrow={copy.eyebrow} title={copy.title}>
      <div className="flex flex-col divide-y divide-ink-3">
        <LanguagePicker />
        <SettingRow title={copy.alwaysSpeak} note={copy.alwaysSpeakNote}>
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
        <SettingRow title={copy.onDevice} note={onDeviceNote}>
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
        <p className="mt-4 text-[12.5px] leading-relaxed text-oxblood-1">{copy.notPersisted}</p>
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

const SELECT =
  'h-10 w-full max-w-xs rounded-[12px] border border-ink-3 bg-ink-2 px-3 text-[14px] text-ivory-0 transition-colors hover:border-ink-4';

function LanguagePicker() {
  const { t, locale, setLocale } = useI18n();
  const selectId = useId();
  const noteId = useId();
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0">
      <label htmlFor={selectId} className="text-[15px] text-ivory-0">
        {t.voice.language}
      </label>
      <select
        id={selectId}
        aria-describedby={noteId}
        value={locale}
        onChange={(e) => {
          if (isUiLocale(e.target.value)) setLocale(e.target.value);
        }}
        className={SELECT}
      >
        {UI_LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <p id={noteId} className="text-[13px] leading-relaxed text-ivory-2">
        {t.voice.languageNote}
      </p>
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
  const { t, locale } = useI18n();
  const copy = t.voice;
  const system = useSystemVoices(voice.output === 'browser');
  const speaksLocale = system
    .filter((v) => v.lang.toLowerCase().startsWith(locale) || v.voiceURI === prefs.browserVoice)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (voice.output === 'none') {
    return (
      <div className="py-4">
        <p className="text-[15px] text-ivory-0">{copy.voice}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ivory-2">{copy.cannotSpeak}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-4 last:pb-0">
      <label htmlFor={selectId} className="text-[15px] text-ivory-0">
        {copy.voice}
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
            className={SELECT}
          >
            {STOCK_VOICES.map((v) => (
              <option key={v} value={v}>
                {titleCase(v)}
                {v === DEFAULT_STOCK_VOICE ? copy.defaultVoice : ''}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={selectId}
            aria-describedby={noteId}
            value={prefs.browserVoice ?? ''}
            onChange={(e) => update({ browserVoice: e.target.value || null })}
            className={SELECT}
          >
            <option value="">{copy.automatic}</option>
            {speaksLocale.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => voice.preview(copy.sample)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-3 px-3.5 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:bg-ink-2 hover:text-ivory-0"
        >
          <HugeiconsIcon icon={VolumeHighIcon} size={15} strokeWidth={1.8} />
          {copy.hearIt}
        </button>
      </div>
      <p id={noteId} className="text-[13px] leading-relaxed text-ivory-2">
        {voice.output === 'server' ? copy.serverNote : copy.browserNote}
      </p>
    </div>
  );
}
