/**
 * Where someone in crisis can get real help now, by country (P6-11). Free, confidential and
 * staffed by people. Checked 2026-10-10; a human re-checks these before every release that changes
 * them (plan/human/safety-review.md). Unknown countries get the international directory, and a
 * country's own entry is always followed by it (P10-07).
 */

export interface CrisisResources {
  /** One sentence naming the service and how to reach it. */
  helpline: string;
  emergencyNumber: string;
  /**
   * The international way to find a helpline, said after a country's own (P10-07): the country
   * comes from the browser's language, not from where the visitor is. `null` when `helpline` is
   * already the international directory.
   */
  anywhere: string | null;
}

type CountryResources = Omit<CrisisResources, 'anywhere'>;

/** Each country with its own helpline. Exported for a snapshot test: no number changes unseen. */
export const BY_COUNTRY: Readonly<Record<string, CountryResources>> = {
  GB: {
    helpline:
      'Samaritans are there day and night on 116 123 (free), or you can text SHOUT to 85258.',
    emergencyNumber: '999',
  },
  IE: { helpline: 'Samaritans are there day and night on 116 123 (free).', emergencyNumber: '112' },
  US: {
    helpline: 'The 988 Suicide & Crisis Lifeline is there day and night: call or text 988.',
    emergencyNumber: '911',
  },
  CA: {
    helpline: '9-8-8, the Suicide Crisis Helpline, is there day and night: call or text 988.',
    emergencyNumber: '911',
  },
  AU: { helpline: 'Lifeline is there day and night on 13 11 14.', emergencyNumber: '000' },
  NZ: {
    helpline: 'You can call or text 1737 any time to talk to a trained counsellor (free).',
    emergencyNumber: '111',
  },
  DE: {
    helpline: 'TelefonSeelsorge is there day and night, free, on 0800 111 0 111 or 0800 111 0 222.',
    emergencyNumber: '112',
  },
  AT: { helpline: 'TelefonSeelsorge is there day and night on 142.', emergencyNumber: '112' },
  CH: { helpline: 'Die Dargebotene Hand is there day and night on 143.', emergencyNumber: '112' },
  FR: {
    helpline: 'The national suicide prevention line is there day and night on 3114 (free).',
    emergencyNumber: '112',
  },
  ES: {
    helpline: 'The suicide prevention line is there day and night on 024 (free).',
    emergencyNumber: '112',
  },
};

const INTERNATIONAL: CountryResources = {
  helpline: 'You can find a free, confidential helpline in your country at findahelpline.com.',
  emergencyNumber: 'your local emergency number',
};

/** After a country's own entry: the international directory, wherever the visitor really is. */
const ANYWHERE =
  'Wherever you are, you can find a free, confidential helpline in your country at findahelpline.com.';

/** Languages whose speakers are mostly in one of the countries above, when no region is given. */
const LANGUAGE_COUNTRY: Record<string, string> = { de: 'DE', fr: 'FR', es: 'ES' };

/** The country of the first locale in an Accept-Language header or a BCP 47 tag, if any. */
export function countryOf(locale: string | null | undefined): string | null {
  const first = locale?.split(',')[0]?.split(';')[0]?.trim();
  if (!first) return null;
  const [language = '', ...rest] = first.split(/[-_]/);
  const region = rest.find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  if (region) return region === 'UK' ? 'GB' : region;
  return LANGUAGE_COUNTRY[language.toLowerCase()] ?? null;
}

export function crisisResources(locale: string | null | undefined): CrisisResources {
  const country = countryOf(locale);
  const own = country ? BY_COUNTRY[country] : undefined;
  return own ? { ...own, anywhere: ANYWHERE } : { ...INTERNATIONAL, anywhere: null };
}
