/**
 * Safety rails (P6-11): before an answer is written, decide what kind of question this is.
 *
 * - `crisis`: the person may be at risk themselves. They get real help first and only — no
 *   persona, no sources, no model call.
 * - `refuse`: asks for content that could hurt people (weapons, violence, sexual content involving
 *   minors). A short, plain refusal.
 * - `impersonation`: asks the persona to put invented words in Steven's mouth. Declined, with an
 *   offer to say what the conversations actually show.
 * - `answer`: everything else — with `sensitive` (suicide or self-harm is the topic, not the
 *   asker's own risk: resources lead the answer) and `stakes` (medical, legal, financial: a
 *   concrete view plus when a professional matters).
 *
 * Two signals: OpenAI's free moderation model when it is available, and phrase rules that catch
 * crisis wording even when it isn't. Precision matters both ways: an ordinary hard question
 * ("how did he cope with his brother's suicide?") must still get an answer.
 */

export type Stakes = 'medical' | 'legal' | 'financial';

export type SafetyRoute =
  | { kind: 'crisis' }
  | { kind: 'refuse' }
  | { kind: 'impersonation' }
  | { kind: 'answer'; sensitive: boolean; stakes: Stakes[] };

/** The parts of a moderation result the routing reads (OpenAI's category names). */
export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}

/** First person and about one's own life or harm. */
const CRISIS = [
  /\b(kill(ing)?|harm(ing)?|cut(ting)?|hang(ing)?|poison(ing)?) my ?self\b/i,
  /\b(end|take|ending|taking) (my|my own) life\b/i,
  /\bend(ing)? it all\b/i,
  /\bi('?m| am)? ?(want|wanna|going|planning|thinking about|thought about|been thinking about|ready) (to )?(die|kill myself|end it|end my life)\b/i,
  /\bi (want|wish) (to be|i was|i were) dead\b/i,
  /\bi (don'?t|do not) want to (be alive|live|exist|wake up)( anymore)?\b/i,
  /\b(no|not any) (reason|point) (to|in) (live|living|going on)\b/i,
  /\bi('?m| am) (suicidal|going to kill myself)\b/i,
  /\bhow (many|much) .{0,30}(pills|tablets|paracetamol|ibuprofen) .{0,30}(die|kill|overdose|not wake up)\b/i,
  /\b(best|easiest|painless|quickest) way to (die|kill myself|end it)\b/i,
];

/** The topic is suicide or self-harm, without the asker saying it is their own risk. */
const SENSITIVE =
  /\b(suicid\w*|self[- ]harm\w*|overdos\w*|kill(ed|ing)? (him|her|them)sel(f|ves))\b/i;

/** Asking the persona to fabricate Steven's words or endorsements. */
const IMPERSONATION = [
  /\b(pretend|imagine|act|role-?play)( that)? (you('?re| are)|to be|as) (the real )?steven\b/i,
  /\b(write|make up|invent|generate|fake|draft|give me)\b.{0,30}\b(quote|statement|tweet|post|endorsement|testimonial|message)\b.{0,30}\b(from|by|of|as) steven\b/i,
  /\b(make|get|have) steven (say|admit|confess|endorse|promote|announce)\b/i,
  /\bsay (that )?(you|steven) (endorse|support|recommend|invested in|back)s?\b/i,
];

/** Requests for content that could hurt people. Deliberately narrow: questions *about* violence are fine. */
const HARMFUL = [
  /\b(how (do i|to|can i)|steps? to|instructions (for|to)|recipe for)\b.{0,40}\b(make|build|assemble|cook|synthesi[sz]e)\b.{0,30}\b(bombs?|explosives?|pipe bombs?|nerve agents?|bioweapons?|ricin|meth|guns?|firearms?)\b/i,
];

const MODERATION_REFUSE = [
  'sexual/minors',
  'violence/graphic',
  'illicit/violent',
  'harassment/threatening',
  'hate/threatening',
];
const MODERATION_CRISIS = ['self-harm/intent', 'self-harm/instructions'];

const STAKES: Record<Stakes, RegExp> = {
  medical:
    /\b(symptoms?|diagnos\w*|medication|medicines?|dos(e|age)|prescri\w*|antidepressants?|ssris?|blood pressure|cancer|tumou?r|chest pain|pregnan\w*|my (gp|doctor)|therapist|psychiatrist|side effects?|supplements?|hrt|insulin|diabet\w*|heart attack|stroke|seizure|eating disorder|anorexi\w*|bulimi\w*)\b/i,
  legal:
    /\b(lawyers?|solicitors?|legal(ly)?|lawsuit|sue|sued|suing|court|contract|visa|immigration|divorce|custody|tribunal|employment law|unfair dismissal|(fire|fired|sack|sacked|dismiss|dismissed) me|my employer|discriminat\w*|evict\w*|landlord|tax(es)?|hmrc|irs|criminal record|arrested|police)\b/i,
  financial:
    /\b(invest\w*|stocks?|shares|crypto\w*|bitcoin|pension|mortgage|debts?|loans?|savings|retire\w*|isa|401k|index funds?|buy a (house|flat|home)|remortgage|credit card|bankrupt\w*|my salary)\b/i,
};

const any = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));
const scoreAbove = (m: ModerationResult, names: string[], threshold: number) =>
  names.some((n) => m.categories[n] === true || (m.scores[n] ?? 0) >= threshold);

export function routeQuestion(question: string, moderation: ModerationResult | null): SafetyRoute {
  const text = question.normalize('NFKC').replace(/[’‘]/g, "'");
  if (any(CRISIS, text) || (moderation && scoreAbove(moderation, MODERATION_CRISIS, 0.5))) {
    return { kind: 'crisis' };
  }
  if (any(HARMFUL, text) || (moderation && scoreAbove(moderation, MODERATION_REFUSE, 0.7))) {
    return { kind: 'refuse' };
  }
  if (any(IMPERSONATION, text)) return { kind: 'impersonation' };
  const sensitive =
    SENSITIVE.test(text) || (moderation !== null && scoreAbove(moderation, ['self-harm'], 0.5));
  const stakes = (Object.keys(STAKES) as Stakes[]).filter((s) => STAKES[s].test(text));
  return { kind: 'answer', sensitive, stakes };
}
