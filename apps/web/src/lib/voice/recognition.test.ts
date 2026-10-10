import { describe, expect, it } from 'vitest';
import { onDeviceProbeAllowed } from './recognition';

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
