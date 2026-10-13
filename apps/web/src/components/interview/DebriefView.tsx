'use client';

import type { DebriefPoint, DebriefScores } from '@dear-steven/core/schema';
import { useI18n } from '@/i18n/I18nProvider';
import type { InterviewAction, InterviewState } from '@/lib/interview';
import { button, demoTag, display, eyebrow, primary } from './styles';

interface DebriefViewProps {
  state: InterviewState;
  dispatch: (action: InterviewAction) => void;
  onBack: () => void;
}

const SCORES: (keyof DebriefScores)[] = ['clarity', 'specificity', 'story', 'brevity'];

/**
 * The practice debrief (P7-07): how it came across, what worked and what to work on (each on the
 * visitor's own words, quoted exactly), one answer the way it could land, and another go at the
 * weakest one.
 */
export function DebriefView({ state, dispatch, onBack }: DebriefViewProps) {
  const { t } = useI18n();
  const copy = t.interview;
  const result = state.debrief;
  if (!result) return null;
  const { debrief, language, demo } = result;
  const rewritten = debrief.rewrite ? state.turns[debrief.rewrite.turn] : undefined;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className={eyebrow}>{copy.debriefEyebrow}</p>
          {demo ? <span className={demoTag}>{t.turn.demoTag}</span> : null}
        </div>
        {debrief.headline ? (
          <h2
            lang={language}
            className="font-display text-[26px] leading-[1.25] text-balance text-ivory-0 sm:text-[32px]"
            style={display}
          >
            {debrief.headline}
          </h2>
        ) : null}
      </div>

      <section aria-label={copy.scoresLabel} className="flex flex-col gap-3">
        <h3 className={eyebrow}>{copy.scoresLabel}</h3>
        <dl className="grid max-w-[26rem] grid-cols-[7.5rem_1fr] items-center gap-x-4 gap-y-2.5">
          {SCORES.map((key) => (
            <div key={key} className="contents">
              <dt className="text-[14px] text-ivory-1">{copy.scores[key]}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="sr-only">{copy.scoreValue(debrief.scores[key])}</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    aria-hidden="true"
                    className={`h-2 w-6 rounded-full ${n <= debrief.scores[key] ? 'bg-ember-0' : 'bg-ink-3'}`}
                  />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Points title={copy.strengths} points={debrief.strengths} language={language} />
      <Points title={copy.improvements} points={debrief.improvements} language={language} />

      <section className="flex flex-col gap-3">
        <h3 className={eyebrow}>{copy.rewriteTitle}</h3>
        {debrief.rewrite && rewritten ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ivory-2">{rewritten.question}</p>
            <p className="border-l border-ink-3 pl-4 text-[14px] leading-relaxed text-ivory-2">
              <span className="sr-only">{copy.rewriteYouSaid}: </span>“{rewritten.answer}”
            </p>
            <blockquote
              lang={language}
              className="border-l border-ember-0/70 pl-4 font-display text-[19px] leading-[1.5] text-ivory-0"
              style={display}
            >
              {debrief.rewrite.answer}
            </blockquote>
            <p lang={language} className="text-[13.5px] text-ivory-2">
              {debrief.rewrite.why}
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-ivory-2">{demo ? copy.noRewriteDemo : copy.noRewrite}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {debrief.weakest !== null ? (
          <button type="button" onClick={() => dispatch({ type: 'retake' })} className={primary}>
            {copy.retake}
          </button>
        ) : null}
        <button type="button" onClick={() => dispatch({ type: 'reset' })} className={button}>
          {copy.newPractice}
        </button>
        <button type="button" onClick={onBack} className={button}>
          {copy.back}
        </button>
      </div>
    </div>
  );
}

function Points({
  title,
  points,
  language,
}: {
  title: string;
  points: DebriefPoint[];
  language: string;
}) {
  const { t } = useI18n();
  if (points.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h3 className={eyebrow}>{title}</h3>
      <ul className="flex flex-col gap-5">
        {points.map((point) => (
          <li key={`${point.turn}-${point.evidence}`} className="flex flex-col gap-2">
            <p lang={language} className="text-[16px] leading-relaxed text-ivory-0">
              {point.text}
            </p>
            <figure className="border-l border-ember-0/70 pl-4">
              <blockquote className="text-[14.5px] leading-relaxed text-ivory-1 italic">
                “{point.evidence}”
              </blockquote>
              <figcaption className="mt-1 font-mono text-[11px] text-steel">
                {t.interview.evidence(point.turn + 1)}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
