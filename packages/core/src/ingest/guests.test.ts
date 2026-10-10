import { describe, expect, it } from 'vitest';
import { extractGuestNames, looksLikePersonName } from './guests.ts';

describe('extractGuestNames — real Diary Of A CEO title styles', () => {
  it.each([
    [
      'Dana White: This Generation Thinks You Can Build A Business From Home, It&#39;s Impossible!',
      ['Dana White'],
    ],
    ['Druski: They&#39;re Lying To You About Overnight Success!', ['Druski']],
    [
      'AI Safety Whistleblower: 700 AI Agents Attacked A Company To Cover Their Tracks! | Jeffrey Ladish',
      ['Jeffrey Ladish'],
    ],
    [
      'Human Lie Detector: The #1 Sign They’re Lying To You! | Dr Leanne ten Brinke',
      ['Dr Leanne ten Brinke'],
    ],
    [
      'Archaeology WARNING:  They Secretly Found Antarctica 300 Years Before Us - Graham Hancock',
      ['Graham Hancock'],
    ],
    [
      'Death of the Middle Class: Billionaire vs Entrepreneur DEBATE - Daniel Priestley v Nick Hanauer',
      ['Daniel Priestley', 'Nick Hanauer'],
    ],
    ['E39: Jamal Edwards - From Media Student To Multimillionaire', ['Jamal Edwards']],
    ['Moment 112 - Want To Sleep Better? Listen To This: Matthew Walker', ['Matthew Walker']],
    [
      'The Peptide Expert: Big Pharma Are Hiding This Powerful Peptide From You! - Dr. Alex Tatem',
      ['Dr Alex Tatem'],
    ],
    ['Professor Jiang: Three Predictions On the Collapse of the World Order', ['Professor Jiang']],
    ['Dr Aria - Mental Health, Marriage and Mindfulness', ['Dr Aria']],
    ['Oz Pearlman (Mentalist): This Small Mistake Makes People Dislike You!', ['Oz Pearlman']],
    [
      'Ann Summers CEO: The Heartbreaking Story Of A Rich Woman: Jacqueline Gold CBE',
      ['Jacqueline Gold'],
    ],
    ['Extended Moment: Guy Raz: Why 99% of Businesses Fail', ['Guy Raz']],
    [
      'Johann Hari - Everything You Think You Know About Meaning & Happiness Is Wrong',
      ['Johann Hari'],
    ],
  ])('%s', (title, expected) => {
    expect(extractGuestNames(title)).toEqual(expected);
  });

  it.each([
    'Creatine Expert: Creatine Is The Secret To Weight Loss',
    'Vitamin D Expert: The Supplement World Is Giving The WRONG Advice!',
    'Billionaire&#39;s WARNING: I&#39;m SELLING. The Crash Is Already Here!',
    'EMERGENCY DEBATE: The Economy Is About To Collapse! The 2026 AI Crisis Nobody Sees Coming',
    'Everything 2020 Taught Me (part 2)',
    'Harvard Professor: &#34;10,000 Steps A Day&#34; Is A LIE!',
    'The Microbiome Doctor: Doctors Were Wrong! The 3 Foods You Should Eat For Perfect Gut Health!',
  ])('finds no guest in a role-only title: %s', (title) => {
    expect(extractGuestNames(title)).toEqual([]);
  });
});

describe('looksLikePersonName', () => {
  it('accepts names with honorifics, particles and initials', () => {
    expect(looksLikePersonName('Dr Leanne ten Brinke')).toBe(true);
    expect(looksLikePersonName('JD Vance')).toBe(true);
    expect(looksLikePersonName('will.i.am')).toBe(false);
  });
  it('rejects roles and long phrases', () => {
    expect(looksLikePersonName('Fat Loss Scientist')).toBe(false);
    expect(looksLikePersonName('The Man Who Made $100M Before 32')).toBe(false);
  });
});
