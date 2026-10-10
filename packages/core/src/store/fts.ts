/** Builds a safe FTS5 query from free text: quoted terms OR-ed together, stopwords dropped. */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being
  below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down
  during each few for from further get gets got had hadn't has hasn't have haven't having he her here
  hers herself him himself his how i i'm i've if in into is isn't it it's its itself just keep let let's
  like me more most mustn't my myself no nor not now of off on once only or other ought our ours
  ourselves out over own really same shan't she should shouldn't so some such than that that's the
  their theirs them themselves then there there's these they they're this those through to too under
  until up very was wasn't we we're were weren't what what's when where which while who whom why will
  with won't would wouldn't you you're your yours yourself yourselves hey steven dear think thing things
  know want way much many also even still ever every one two say said tell told talk talked
  ask asked yeah okay ok`
    .split(/\s+/)
    .filter(Boolean),
);

export function toFtsQuery(text: string, maxTerms = 24): string | null {
  const tokens =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/’/g, "'")
      .match(/[a-z0-9][a-z0-9']*/g) ?? [];
  const terms: string[] = [];
  for (const raw of tokens) {
    if (STOPWORDS.has(raw)) continue;
    const t = raw.replace(/'s$/, '').replace(/'/g, '');
    if (t.length < 3 || STOPWORDS.has(t) || terms.includes(t)) continue;
    terms.push(t);
    if (terms.length >= maxTerms) break;
  }
  return terms.length ? terms.map((t) => `"${t}"`).join(' OR ') : null;
}
