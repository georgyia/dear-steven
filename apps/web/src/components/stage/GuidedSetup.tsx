'use client';

import {
  SETUP_MAX_BUDGET_USD,
  type SetupKeys,
  type SetupRun,
  type SetupStage,
  type SetupState,
} from '@dear-steven/core/schema';
import { useEffect, useId, useRef, useState } from 'react';
import { Rich } from '@/components/ui/Rich';
import { useI18n } from '@/i18n/I18nProvider';
import { usd } from '@/lib/money';
import { fetchSetup, runSetupStage, saveSetupKeys } from '@/lib/setup';

interface GuidedSetupProps {
  token: string;
  state: SetupState;
  onState: (state: SetupState) => void;
  /** Something changed on the server: ask for the knowledge-base status again. */
  onProgress: () => void;
}

const MAX_LOG_LINES = 200;
const STATUS_POLL_MS = 2000;

/** A cap with room above the estimate, so a slightly longer passage doesn't refuse the run. */
const suggestedCap = (estimate: number) =>
  estimate > 0 ? Math.min(SETUP_MAX_BUDGET_USD, Math.ceil(estimate * 150) / 100) : 0;

const field =
  'rounded-full border border-ink-3 bg-ink-1 px-4 py-2 text-[14px] text-ivory-0 placeholder:text-steel focus:border-ember-0/60 focus:outline-none disabled:opacity-60';
const primary =
  'rounded-full bg-ember-0 px-4 py-2 text-[14px] font-medium text-ink-0 transition-colors hover:bg-ember-1 disabled:opacity-60';
const secondary =
  'rounded-full border border-ink-3 px-4 py-2 text-[14px] text-ivory-0 transition-colors hover:border-ember-0/60 hover:text-ember-1 disabled:opacity-60 disabled:hover:border-ink-3 disabled:hover:text-ivory-0';

/**
 * Guided local setup (P6-04): save keys to the env file and run the ingest stages from the setup
 * panel, with their output as it happens. Only rendered when `pnpm dev:setup` started the server.
 */
export function GuidedSetup({ token, state, onState, onProgress }: GuidedSetupProps) {
  const id = useId();
  const { t, locale } = useI18n();
  const copy = t.setup.guided;
  const money = (x: number) => usd(x, locale);

  const [openaiKey, setOpenaiKey] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
  const [budget, setBudget] = useState(state.dailyBudgetUsd?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [keysNote, setKeysNote] = useState<{ text: string; problem: boolean } | null>(null);

  const [newest, setNewest] = useState('20');
  const [cap, setCap] = useState(() => suggestedCap(state.embedding.usd).toString());
  useEffect(() => setCap(suggestedCap(state.embedding.usd).toString()), [state.embedding.usd]);

  const [running, setRunning] = useState<SetupStage | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<{ text: string; problem: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useEffect(() => () => abortRef.current?.abort(), []);

  // While a stage runs, the checklist above follows along.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => progressRef.current(), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever a line arrives
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const keys: SetupKeys = { dailyBudgetUsd: budget.trim() === '' ? null : Number(budget) };
    if (openaiKey.trim()) keys.openaiApiKey = openaiKey.trim();
    if (youtubeKey.trim()) keys.youtubeApiKey = youtubeKey.trim();
    setSaving(true);
    setKeysNote(null);
    try {
      const next = await saveSetupKeys(token, keys);
      setOpenaiKey('');
      setYoutubeKey('');
      onState(next);
      onProgress();
      setKeysNote({ text: copy.savedNote(next.envFile), problem: false });
    } catch (error) {
      setKeysNote({ text: error instanceof Error ? error.message : String(error), problem: true });
    } finally {
      setSaving(false);
    }
  }

  /** Streams one stage's output into the log; resolves to whether it succeeded. */
  async function runStage(step: SetupRun, signal: AbortSignal): Promise<boolean> {
    setRunning(step.stage);
    let ok = false;
    for await (const event of runSetupStage(token, step, signal)) {
      if (event.type === 'line') setLog((lines) => [...lines, event.text].slice(-MAX_LOG_LINES));
      else ok = event.ok;
    }
    return ok;
  }

  async function run(steps: SetupRun[]) {
    if (running) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLog([]);
    setOutcome(null);
    let result = { text: copy.finished, problem: false };
    try {
      for (const step of steps) {
        if (!(await runStage(step, ctrl.signal))) {
          result = { text: copy.failed(copy.stages[step.stage]), problem: true };
          break;
        }
      }
    } catch (error) {
      result = { text: error instanceof Error ? error.message : String(error), problem: true };
    }
    if (ctrl.signal.aborted) return;
    setRunning(null);
    setOutcome(result);
    onProgress();
    const next = await fetchSetup(token).catch(() => null);
    if (next) onState(next);
  }

  const limit = Number(newest);
  const limitOk = Number.isInteger(limit) && limit >= 1 && limit <= 500;
  const capUsd = Number(cap);
  const capOk = capUsd > 0 && capUsd <= SETUP_MAX_BUDGET_USD;
  const waiting = state.embedding.passages > 0;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-6 flex flex-col gap-6 border-t border-ink-3 pt-5"
    >
      <div>
        <h3 id={`${id}-title`} className="text-[16px] font-medium text-ivory-0">
          {copy.title}
        </h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ivory-2">
          <Rich text={copy.intro} />
        </p>
      </div>

      <form onSubmit={save} className="flex flex-col gap-3" aria-labelledby={`${id}-keys`}>
        <h4 id={`${id}-keys`} className="text-[15px] font-medium text-ivory-0">
          {copy.keysHeading}
        </h4>
        {(
          [
            ['openai', copy.openai, openaiKey, setOpenaiKey, state.keys.openai, 'sk-…'],
            ['youtube', copy.youtube, youtubeKey, setYoutubeKey, state.keys.youtube, 'AIza…'],
          ] as const
        ).map(([key, label, value, setValue, saved, example]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-${key}`} className="text-[13.5px] text-ivory-1">
              {label}
            </label>
            <input
              id={`${id}-${key}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={saved ? copy.saved : `${copy.notSaved} — ${example}`}
              className={`${field} font-mono`}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-budget`} className="text-[13.5px] text-ivory-1">
            {copy.budget}
          </label>
          <input
            id={`${id}-budget`}
            type="number"
            inputMode="decimal"
            min={0}
            max={1000}
            step={0.01}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={`${field} w-32 font-mono`}
          />
        </div>
        <div>
          <button type="submit" disabled={saving} className={primary}>
            {saving ? copy.saving : copy.save(state.envFile)}
          </button>
        </div>
        <p
          role={keysNote?.problem ? 'alert' : 'status'}
          className={`text-[13px] empty:hidden ${keysNote?.problem ? 'text-oxblood-1' : 'text-ivory-2'}`}
        >
          {keysNote?.text}
        </p>
      </form>

      <div className="flex flex-col gap-3">
        <h4 className="text-[15px] font-medium text-ivory-0">{copy.buildHeading}</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-newest`} className="text-[13.5px] text-ivory-1">
              {copy.newest}
            </label>
            <input
              id={`${id}-newest`}
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={newest}
              onChange={(e) => setNewest(e.target.value)}
              className={`${field} w-24 font-mono`}
            />
          </div>
          <button
            type="button"
            disabled={running !== null || !limitOk}
            onClick={() =>
              void run([{ stage: 'discover' }, { stage: 'transcribe', limit }, { stage: 'chunk' }])
            }
            className={secondary}
          >
            {copy.build}
          </button>
        </div>
        <p className="text-[12.5px] text-ivory-2">{copy.buildNote}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-[15px] font-medium text-ivory-0">{copy.embedHeading}</h4>
        <p className="text-[13.5px] text-ivory-2">
          {waiting
            ? copy.estimate(state.embedding.passages, money(state.embedding.usd))
            : copy.nothingToEmbed}
        </p>
        {waiting && !state.keys.openai ? (
          <p className="text-[13px] text-ivory-2">{copy.needsOpenAI}</p>
        ) : null}
        {waiting && state.keys.openai ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-cap`} className="text-[13.5px] text-ivory-1">
                {copy.cap}
              </label>
              <input
                id={`${id}-cap`}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={SETUP_MAX_BUDGET_USD}
                step={0.01}
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className={`${field} w-28 font-mono`}
              />
            </div>
            <button
              type="button"
              disabled={running !== null || !capOk}
              onClick={() => void run([{ stage: 'index', budgetUsd: capUsd }])}
              className={secondary}
            >
              {copy.embed(money(state.embedding.usd))}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-[15px] font-medium text-ivory-0">{copy.youtubeHeading}</h4>
        <div>
          <button
            type="button"
            disabled={running !== null || !state.keys.youtube}
            onClick={() => void run([{ stage: 'match-youtube' }])}
            className={secondary}
          >
            {copy.link}
          </button>
        </div>
        <p className="text-[12.5px] text-ivory-2">
          {state.keys.youtube ? copy.linkNote : copy.needsYouTube}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h4 id={`${id}-progress`} className="text-[15px] font-medium text-ivory-0">
          {copy.progress}
        </h4>
        <p
          role={outcome?.problem ? 'alert' : 'status'}
          className={`text-[13.5px] empty:hidden ${outcome?.problem ? 'text-oxblood-1' : 'text-ivory-1'}`}
        >
          {running ? copy.running(copy.stages[running]) : outcome?.text}
        </p>
        <pre
          ref={logRef}
          role="log"
          aria-labelledby={`${id}-progress`}
          className="max-h-56 overflow-auto rounded-xl border border-ink-3 bg-ink-1 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ivory-2 empty:hidden"
        >
          {log.join('\n')}
        </pre>
        <p className="text-[12.5px] text-steel">{copy.spent(money(state.spentUsd))}</p>
      </div>
    </section>
  );
}
