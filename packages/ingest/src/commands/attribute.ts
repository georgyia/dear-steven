import type { Context } from '../context.ts';
import { c, table } from '../lib/output.ts';

/**
 * Stage 4 (QA): a deterministic speaker report for diarized episodes. Flags the cases where
 * attribution deserves a human look before it is trusted: a host share that is implausibly low or
 * high (enrolment probably failed), and multi-guest panels where guests stay anonymous.
 */
export function attribute(ctx: Context) {
  const episodes = ctx.store.listEpisodes().filter((e) => e.transcriptSource === 'openai-diarize');
  if (episodes.length === 0) {
    console.log('No diarized episodes yet. See plan/human/transcription-budget.md.');
    return;
  }
  const rows = episodes.map((e) => {
    const segs = ctx.store.getSegments(e.id);
    const words = (s: { text: string }) => s.text.split(/\s+/).length;
    const total = segs.reduce((n, s) => n + words(s), 0) || 1;
    const host = segs.filter((s) => s.speaker === 'host').reduce((n, s) => n + words(s), 0) / total;
    const flags = [
      host < 0.08 ? 'host barely detected — check the voice clip' : '',
      host > 0.75 ? 'host dominates — guest may be mislabelled' : '',
      e.guestNames.length !== 1
        ? `${e.guestNames.length || 'no'} named guests — guest speech stays anonymous`
        : '',
    ].filter(Boolean);
    return [
      e.title.slice(0, 50),
      `${Math.round(host * 100)}%`,
      e.guestNames.join(', ') || '—',
      flags.length ? c.yellow(flags.join('; ')) : c.green('ok'),
    ];
  });
  table(rows, ['episode', 'host share', 'guests', 'flags']);
}
