import { describe, expect, it } from 'vitest';
import { onDeviceProbeAllowed, recognitionLang } from './recognition';

describe('onDeviceProbeAllowed', () => {
  it('probes on-device recognition only in Google Chrome', () => {
    const brands = (...names: string[]) => ({
      userAgentData: { brands: names.map((brand) => ({ brand, version: '156' })) },
    });
    expect(onDeviceProbeAllowed(brands('Not A;Brand', 'Chromium', 'Google Chrome'))).toBe(true);
    // Plain Chromium crashes the tab on `available({ processLocally: true })`.
    expect(onDeviceProbeAllowed(brands('Not A;Brand', 'Chromium'))).toBe(false);
    expect(onDeviceProbeAllowed(brands('Microsoft Edge', 'Chromium'))).toBe(false);
    expect(onDeviceProbeAllowed({})).toBe(false); // Safari, Firefox: no userAgentData
    expect(onDeviceProbeAllowed(undefined)).toBe(false);
  });
});

describe('recognitionLang (P6-02)', () => {
  it('listens in the interface language, in the browser’s regional form when it matches', () => {
    expect(recognitionLang('de', 'de-AT')).toBe('de-AT');
    expect(recognitionLang('en', 'en-US')).toBe('en-US');
    expect(recognitionLang('de', 'en-US')).toBe('de-DE');
    expect(recognitionLang('en', 'fr-FR')).toBe('en-GB');
    expect(recognitionLang('en', '')).toBe('en-GB');
  });
});
