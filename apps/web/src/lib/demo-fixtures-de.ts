import type { ResolvedBlock } from '@dear-steven/core/schema';
import type { DemoAnswer } from './demo-fixtures';

/**
 * The demo fixtures' prose in German, keyed by the English (P6-02), so a question asked in German
 * gets a German demo answer — as a live answer would (P6-01). Quotes stay verbatim and English,
 * with a translation beneath them. Still fixtures, still labelled demo.
 */
export const GERMAN: Record<string, string> = {
  // procrastination
  'Separates hard tasks from unpleasant ones — the core of your situation.':
    'Trennt schwere Aufgaben von unangenehmen — der Kern deiner Situation.',
  'Explains why avoiding the task feels good in the moment.':
    'Erklärt, warum es sich im Moment gut anfühlt, der Aufgabe auszuweichen.',
  'A concrete tactic for starting when you already know what to do.':
    'Eine konkrete Taktik, um anzufangen, wenn du schon weißt, was zu tun ist.',
  'Yeah — I think the interesting thing about procrastination is that it’s almost never about not knowing what to do.':
    'Ja — ich finde, das Interessante am Aufschieben ist, dass es fast nie daran liegt, dass man nicht weiß, was zu tun ist.',
  'In one of my conversations, the point came up that we delay the things that make us feel something unpleasant — boredom, doubt, the fear of doing it badly — far more than things that are simply hard.':
    'In einem meiner Gespräche kam der Gedanke auf, dass wir Dinge, bei denen wir etwas Unangenehmes fühlen — Langeweile, Zweifel, die Angst, es schlecht zu machen —, viel eher aufschieben als Dinge, die einfach nur schwer sind.',
  'When I sat down with the behavioural scientist in this demo, they explained that an ambiguous task registers as a small threat, and walking away from it gives you instant relief — which is exactly what makes the habit stick.':
    'Der Gast aus der Verhaltensforschung in dieser Demo hat mir erklärt, dass eine unklare Aufgabe als kleine Bedrohung wahrgenommen wird und dass es sofort Erleichterung bringt, sich von ihr abzuwenden — und genau deshalb setzt sich die Gewohnheit fest.',
  'So the delay isn’t laziness. It’s a mood-repair strategy that works brilliantly for ten minutes and terribly for ten weeks.':
    'Das Aufschieben ist also keine Faulheit. Es ist eine Strategie, die Stimmung zu reparieren — sie funktioniert zehn Minuten lang großartig und zehn Wochen lang furchtbar.',
  'The line from that conversation that stayed with me:':
    'Der Satz aus diesem Gespräch, der mir hängen geblieben ist:',
  'you don’t procrastinate on the work. You procrastinate on the feeling the work gives you.':
    'Du schiebst nicht die Arbeit auf. Du schiebst das Gefühl auf, das dir die Arbeit gibt.',
  'A founder I spoke to came at it from the practical side: shrink the first step until it’s almost embarrassing — open the document, write one ugly sentence — because momentum does what motivation can’t.':
    'Ein Gründer, mit dem ich gesprochen habe, ging es praktisch an: Mach den ersten Schritt so klein, dass er fast peinlich ist — das Dokument öffnen, einen hässlichen Satz schreiben —, denn Schwung schafft, was Motivation nicht schafft.',
  'If I were in your shoes, I’d name the feeling this project gives you, then define a ten-minute first step and do it before lunch tomorrow. Not the project — just the step.':
    'An deiner Stelle würde ich das Gefühl benennen, das dieses Projekt in dir auslöst, dann einen ersten Schritt von zehn Minuten festlegen und ihn morgen vor dem Mittagessen erledigen. Nicht das Projekt — nur den Schritt.',
  'Yeah — procrastination is rarely about not knowing what to do. It’s about avoiding how the work makes you feel. One guest put it perfectly: you don’t procrastinate on the work, you procrastinate on the feeling. So name that feeling, shrink the first step until it’s almost embarrassing, and do it tomorrow morning. The sources are on screen if you want to dig in.':
    'Ja — beim Aufschieben geht es selten darum, nicht zu wissen, was zu tun ist. Es geht darum, dem Gefühl auszuweichen, das die Arbeit in dir auslöst. Ein Gast hat es perfekt gesagt: Du schiebst nicht die Arbeit auf, du schiebst das Gefühl auf. Benenn also dieses Gefühl, mach den ersten Schritt fast peinlich klein und erledige ihn morgen früh. Die Quellen siehst du auf dem Bildschirm, wenn du tiefer einsteigen willst.',

  // discipline
  'Plans for the days motivation doesn’t show up.':
    'Plant für die Tage, an denen die Motivation nicht auftaucht.',
  'Frames consistency as identity rather than effort.':
    'Versteht Beständigkeit als Frage der Identität, nicht der Anstrengung.',
  'I’ll be honest — only a couple of my conversations go straight at this, so take this as a starting point rather than the final word.':
    'Ich bin ehrlich — nur ein paar meiner Gespräche gehen direkt darauf ein, also nimm das als Ausgangspunkt, nicht als letztes Wort.',
  'A performance coach I spoke with said motivation is the weather — you can’t plan a season around it. What you can do is decide in advance what the minimum looks like on a bad day, and make it so small you never miss twice.':
    'Ein Performance-Coach, mit dem ich gesprochen habe, sagte, Motivation sei das Wetter — danach kannst du keine Saison planen. Was du tun kannst: im Voraus festlegen, wie das Minimum an einem schlechten Tag aussieht, und es so klein machen, dass du nie zweimal hintereinander aussetzt.',
  'Later in that same conversation we got onto identity: the people who stay consistent stop asking whether they feel like it, and start asking what someone like them would do today.':
    'Später im selben Gespräch kamen wir auf Identität: Menschen, die dranbleiben, fragen nicht mehr, ob sie Lust haben, sondern was jemand wie sie heute tun würde.',
  'Motivation is the weather. You can’t plan a season around the weather. What you can do is decide in advance what the minimum looks like on a bad day — and make the minimum so small that you never miss it twice.':
    'Motivation ist das Wetter. Nach dem Wetter kannst du keine Saison planen. Was du tun kannst: im Voraus entscheiden, wie das Minimum an einem schlechten Tag aussieht — und das Minimum so klein machen, dass du es nie zweimal verpasst.',
  'So I wouldn’t try to feel more disciplined. I’d write down your bad-day minimum tonight, and protect one rule: never miss twice.':
    'Ich würde also nicht versuchen, mich disziplinierter zu fühlen. Ich würde heute Abend dein Minimum für schlechte Tage aufschreiben und eine Regel verteidigen: nie zweimal hintereinander aussetzen.',
  'Only a couple of my conversations go straight at this, so treat it as a starting point. One coach called motivation the weather — you can’t plan around it. Decide your bad-day minimum in advance, make it tiny, and never miss twice. Over time it stops being discipline and starts being who you are.':
    'Nur ein paar meiner Gespräche gehen direkt darauf ein, nimm es also als Ausgangspunkt. Ein Coach nannte Motivation das Wetter — danach kannst du nicht planen. Leg dein Minimum für schlechte Tage im Voraus fest, mach es winzig und setz nie zweimal hintereinander aus. Mit der Zeit ist es keine Disziplin mehr, sondern ein Teil von dir.',
  'Only two conversations in this demo address discipline directly.':
    'Nur zwei Gespräche in dieser Demo behandeln Disziplin direkt.',

  // business
  'A test for whether an idea is a business yet.':
    'Ein Test dafür, ob eine Idee schon ein Unternehmen ist.',
  'How to start before you feel ready.': 'Wie du anfängst, bevor du dich bereit fühlst.',
  'The founder in this demo had a line I keep coming back to: fall in love with a problem, not your idea — and if you can’t find ten people who’ll pay for the ugly first version, you don’t have a business yet.':
    'Der Gründer in dieser Demo hatte einen Satz, auf den ich immer wieder zurückkomme: Verlieb dich in ein Problem, nicht in deine Idee — und wenn du keine zehn Leute findest, die für die hässliche erste Version bezahlen, hast du noch kein Unternehmen.',
  'That’s a much harsher test than “do my friends like it”, which is exactly why it’s useful.':
    'Das ist ein viel härterer Test als „Gefällt es meinen Freunden?“ — und genau deshalb ist er nützlich.',
  'The same founder was clear that you don’t wait to feel ready — the first step should be too small to argue with.':
    'Derselbe Gründer war sich sicher, dass man nicht wartet, bis man sich bereit fühlt — der erste Schritt sollte zu klein sein, um darüber zu diskutieren.',
  'Before you build anything, I’d write down the problem in one sentence and go and find ten people who have it. Their answers will tell you more than any business plan.':
    'Bevor du irgendetwas baust, würde ich das Problem in einem Satz aufschreiben und zehn Leute suchen, die es haben. Ihre Antworten verraten dir mehr als jeder Businessplan.',
  'Fall in love with the problem, not the idea. If you can’t find ten people who’ll pay for the ugly first version, you don’t have a business yet. So write the problem down in one sentence, and go and talk to ten people who have it.':
    'Verlieb dich in das Problem, nicht in die Idee. Wenn du keine zehn Leute findest, die für die hässliche erste Version bezahlen, hast du noch kein Unternehmen. Schreib das Problem also in einem Satz auf und sprich mit zehn Leuten, die es haben.',

  // insufficient
  'I looked, and none of the conversations in this demo really answer that — and I’d rather tell you that than make something up.':
    'Ich habe nachgesehen, und keines der Gespräche in dieser Demo beantwortet das wirklich — und das sage ich dir lieber, als mir etwas auszudenken.',
  'Try asking about procrastination, discipline or starting a business — those are the three topics the demo fixtures cover.':
    'Frag doch nach Aufschieben, Disziplin oder einer Unternehmensgründung — das sind die drei Themen, die die Demo-Beispiele abdecken.',
  'I looked, and none of the demo conversations really answer that — I’d rather say so than make something up. Try procrastination, discipline or starting a business.':
    'Ich habe nachgesehen, und keines der Demo-Gespräche beantwortet das wirklich — das sage ich lieber, als mir etwas auszudenken. Versuch es mit Aufschieben, Disziplin oder einer Unternehmensgründung.',
  'Demo mode only covers three topics.': 'Der Demo-Modus deckt nur drei Themen ab.',

  // talk replies (P7-05)
  'Honestly? It’s almost never about not knowing what to do.':
    'Ehrlich? Es liegt fast nie daran, dass man nicht weiß, was zu tun ist.',
  'In one of my conversations, the point came up that we delay what makes us feel something unpleasant far more than what’s simply hard.':
    'In einem meiner Gespräche kam der Gedanke auf, dass wir viel eher aufschieben, was sich unangenehm anfühlt, als was einfach nur schwer ist.',
  'So what does this one make you feel?': 'Also: Welches Gefühl löst diese Aufgabe in dir aus?',
  'Honestly, it’s almost never about not knowing what to do. One of my conversations made the point that we delay what makes us feel something unpleasant far more than what’s simply hard. So what does this one make you feel?':
    'Ehrlich, es liegt fast nie daran, dass man nicht weiß, was zu tun ist. In einem meiner Gespräche ging es darum, dass wir viel eher aufschieben, was sich unangenehm anfühlt, als was einfach nur schwer ist. Also: Welches Gefühl löst diese Aufgabe in dir aus?',
  'Stop waiting to feel like it.': 'Hör auf zu warten, bis du Lust hast.',
  'The performance coach in this demo called motivation the weather, and said to decide in advance what the minimum looks like on a bad day.':
    'Der Coach in dieser Demo nannte Motivation das Wetter und riet, im Voraus festzulegen, wie das Minimum an einem schlechten Tag aussieht.',
  'What’s your minimum?': 'Was ist dein Minimum?',
  'Stop waiting to feel like it. The coach in this demo called motivation the weather, and said to decide your bad-day minimum in advance. So, what’s your minimum?':
    'Hör auf zu warten, bis du Lust hast. Der Coach in dieser Demo nannte Motivation das Wetter und riet, dein Minimum für schlechte Tage im Voraus festzulegen. Also, was ist dein Minimum?',
  'Start, but start smaller than you think.': 'Fang an, aber kleiner, als du denkst.',
  'The founder in this demo had a simple test: if you can’t find ten people who’ll pay for the ugly first version, it isn’t a business yet.':
    'Der Gründer in dieser Demo hatte einen einfachen Test: Wenn du keine zehn Leute findest, die für die hässliche erste Version zahlen, ist es noch kein Geschäft.',
  'Who are your first ten?': 'Wer sind deine ersten zehn?',
  'Start, but start smaller than you think. The founder in this demo had a simple test: if you can’t find ten people who’ll pay for the ugly first version, it isn’t a business yet. Who are your first ten?':
    'Fang an, aber kleiner, als du denkst. Der Gründer in dieser Demo hatte einen einfachen Test: Wenn du keine zehn Leute findest, die für die hässliche erste Version zahlen, ist es noch kein Geschäft. Wer sind deine ersten zehn?',
  'That’s outside the conversations in this demo, and I’d rather say so than make something up.':
    'Das liegt außerhalb der Gespräche in dieser Demo, und das sage ich lieber, als mir etwas auszudenken.',
  'Try me on procrastination, discipline or starting a business?':
    'Frag mich doch nach Aufschieben, Disziplin oder einer Unternehmensgründung?',
  'That’s outside the conversations in this demo, and I’d rather say so than make something up. Try me on procrastination, discipline or starting a business?':
    'Das liegt außerhalb der Gespräche in dieser Demo, und das sage ich lieber, als mir etwas auszudenken. Frag mich doch nach Aufschieben, Disziplin oder einer Unternehmensgründung?',
};

const german = (text: string) => GERMAN[text] ?? text;

const inGermanBlock = (b: ResolvedBlock): ResolvedBlock =>
  b.kind === 'quote'
    ? { ...b, lead: b.lead === null ? null : german(b.lead), translation: german(b.text) }
    : { ...b, segments: b.segments.map((s) => ({ ...s, text: german(s.text) })) };

/** A fixture answer for a question asked in German: the prose in German, quotes still verbatim. */
export function inGerman(answer: DemoAnswer): DemoAnswer {
  return {
    ...answer,
    citations: answer.citations.map((c) => ({
      ...c,
      relevance: c.relevance === null ? null : german(c.relevance),
    })),
    blocks: answer.blocks.map(inGermanBlock),
    spoken: german(answer.spoken),
    caveats: answer.caveats.map(german),
    talk: { block: inGermanBlock(answer.talk.block), spoken: german(answer.talk.spoken) },
  };
}
