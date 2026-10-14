import { describe, expect, it } from 'vitest';
import { newSealingKey, openKey, REMEMBER_DAYS, sealKey } from './visitor-key';

/**
 * The visitor's key at rest (P8-01): sealed, never plain text, and only ever opened where and
 * while it was meant to be. Where it is kept (storage, IndexedDB) is covered by
 * `e2e/own-key.spec.ts`.
 */
const KEY = `sk-proj-${'Ab3'.repeat(16)}`;
const NOW = Date.UTC(2026, 9, 13);
const DAY = 86_400_000;
/** Seals tampered with: enough that a one-in-64 slip would show (P8-07). */
const SEALS = 200;

describe('sealing the visitor’s key', () => {
  it('keeps no trace of the key in what is stored', async () => {
    const sealing = await newSealingKey();
    for (const remembered of [false, true]) {
      const sealed = await sealKey(KEY, sealing, remembered, NOW);
      expect(sealed).not.toContain('sk-');
      expect(sealed).not.toContain(KEY.slice(-12));
      expect(await openKey(sealed, sealing, remembered, NOW)).toBe(KEY);
    }
  });

  it('uses a sealing key that cannot be exported', async () => {
    const sealing = await newSealingKey();
    expect(sealing.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', sealing)).rejects.toThrow();
  });

  it('seals the same key differently every time', async () => {
    const sealing = await newSealingKey();
    expect(await sealKey(KEY, sealing, false, NOW)).not.toBe(
      await sealKey(KEY, sealing, false, NOW),
    );
  });

  it(`opens a remembered key for ${REMEMBER_DAYS} days, then never again`, async () => {
    const sealing = await newSealingKey();
    const sealed = await sealKey(KEY, sealing, true, NOW);
    expect(await openKey(sealed, sealing, true, NOW + (REMEMBER_DAYS - 1) * DAY)).toBe(KEY);
    expect(await openKey(sealed, sealing, true, NOW + REMEMBER_DAYS * DAY)).toBe(null);
  });

  it('can’t be given a longer life, moved between tab and device, or opened by another key', async () => {
    const sealing = await newSealingKey();
    const remembered = await sealKey(KEY, sealing, true, NOW);
    const [v, where, , iv, data] = remembered.split('.');
    const later = String(NOW + 400 * DAY);
    expect(await openKey([v, where, later, iv, data].join('.'), sealing, true, NOW)).toBe(null);
    // Within 30 days of now, but not the expiry it was sealed with.
    const forged = String(NOW + 20 * DAY);
    expect(await openKey([v, where, forged, iv, data].join('.'), sealing, true, NOW)).toBe(null);

    const tab = await sealKey(KEY, sealing, false, NOW);
    expect(await openKey(tab, sealing, true, NOW)).toBe(null);
    expect(await openKey(tab.replace('.tab.', '.device.'), sealing, true, NOW)).toBe(null);
    expect(await openKey(remembered, sealing, false, NOW)).toBe(null);

    expect(await openKey(tab, await newSealingKey(), false, NOW)).toBe(null);
  });

  it('treats anything else in storage as nothing', async () => {
    const sealing = await newSealingKey();
    for (const junk of ['', 'v1', 'v1.tab.0..', 'v2.tab.0.aaaa.bbbb', 'v1.tab.0.@@@@.####', KEY]) {
      expect(await openKey(junk, sealing, false, NOW)).toBe(null);
    }
    // One changed character of the ciphertext, whatever it was (P8-07), over many fresh seals: the
    // second-to-last carries six bits of data, so it can't hide in base64 padding.
    for (let i = 0; i < SEALS; i++) {
      const tab = await sealKey(KEY, sealing, false, NOW);
      const at = tab.length - 2;
      const flipped = `${tab.slice(0, at)}${tab[at] === 'A' ? 'B' : 'A'}${tab.slice(at + 1)}`;
      expect(flipped).not.toBe(tab);
      expect(await openKey(flipped, sealing, false, NOW)).toBe(null);
    }
  });
});
