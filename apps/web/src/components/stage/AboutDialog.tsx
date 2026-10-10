'use client';

import { brand } from '@/brand';
import { Dialog } from '@/components/ui/Dialog';

/** "How this works": the persona, the four kinds of statement, and what happens to your data. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="How this works"
      title="An AI persona with receipts"
      width="lg"
    >
      <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-ivory-1">
        <p>
          {brand.name} answers in the first person, in the spirit of {brand.host.fullName}’s public
          interview persona. It is an AI — not {brand.host.firstName}, and not affiliated with{' '}
          {brand.show}. Its knowledge comes from transcripts of real episodes, and every claim it
          attributes to anyone links to the exact passage it came from.
        </p>

        <section>
          <h3 className="mb-3 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            Four kinds of statement
          </h3>
          <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-5">
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-ember-tint px-2 font-mono text-[11.5px] text-ember-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-ember-0" />
                  {brand.host.firstName} · 32:14
                </span>
              }
              title="Something the host actually said"
              body="Only when the transcript has verified speaker labels."
            />
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-ink-3 px-2 font-mono text-[11.5px] text-ivory-0">
                  <span className="grid h-[15px] min-w-[15px] place-items-center rounded-full bg-ivory-0 text-[8.5px] font-semibold text-ink-0">
                    G
                  </span>
                  Guest · 32:14
                </span>
              }
              title="Something a guest actually said"
              body="Also requires verified speaker labels."
            />
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center rounded-full border border-dashed border-steel/60 px-2 font-mono text-[11.5px] text-steel">
                  Episode · 32:14
                </span>
              }
              title="From a real conversation — speaker not verified"
              body="The passage is real; the transcript just doesn’t say who was talking."
            />
            <Legend
              chip={<span className="text-[15px] text-ivory-1">Softer text, no chip</span>}
              title="My own reasoning"
              body="Synthesis and advice. Never presented as something anyone said."
            />
          </dl>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            Checked, not trusted
          </h3>
          <p>
            The model never writes citation markup. It returns a structured answer, and the server
            checks every citation against the passages it actually retrieved: unknown sources are
            dropped, speaker claims must match the transcript, and quotes are shown from the stored
            transcript — never from the model’s memory. If the conversations don’t cover your
            question, it says so.
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            Your data
          </h3>
          <p>
            Questions are sent to the server and to OpenAI to compose an answer, and are not stored.
            The microphone is only used while you hold or toggle it. Short, attributed quotations
            link back to the original episodes; full transcripts are never published. The video
            player and the podcast audio load from YouTube and the podcast’s host only when you
            press play. Voice settings — and, only if you switch it on, the conversation itself —
            are kept in this browser only, until you forget them.
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function Legend({ chip, title, body }: { chip: React.ReactNode; title: string; body: string }) {
  return (
    <>
      <dt className="pt-0.5">{chip}</dt>
      <dd className="mb-2 sm:mb-0">
        <span className="text-ivory-0">{title}.</span> <span className="text-ivory-2">{body}</span>
      </dd>
    </>
  );
}
