import { describe, expect, it } from 'vitest';
import {
  ACCESS_MAX_AGE_S,
  accessCookie,
  codeMatches,
  issueAccessToken,
  validAccessToken,
} from './access';

const NOW = Date.parse('2026-10-10T12:00:00Z');

describe('access tokens', () => {
  it('accepts a token this code issued, until it expires', async () => {
    const token = await issueAccessToken('open sesame', NOW);
    expect(await validAccessToken('open sesame', token, NOW + 1000)).toBe(true);
    expect(await validAccessToken('open sesame', token, NOW + ACCESS_MAX_AGE_S * 1000)).toBe(false);
  });

  it('refuses another code’s token, a tampered expiry or signature, and junk', async () => {
    const token = await issueAccessToken('open sesame', NOW);
    expect(await validAccessToken('new code', token, NOW)).toBe(false);
    const [expiry, signature] = token.split('.');
    const later = String(Number(expiry) + 86_400);
    expect(await validAccessToken('open sesame', `${later}.${signature}`, NOW)).toBe(false);
    const flipped = `${signature?.slice(0, -1)}${signature?.endsWith('A') ? 'B' : 'A'}`;
    expect(await validAccessToken('open sesame', `${expiry}.${flipped}`, NOW)).toBe(false);
    for (const junk of [undefined, '', 'x', `${expiry}.`, `${expiry}.${signature}.x`]) {
      expect(await validAccessToken('open sesame', junk, NOW)).toBe(false);
    }
  });

  it('compares codes exactly', async () => {
    expect(await codeMatches('open sesame', 'open sesame')).toBe(true);
    expect(await codeMatches('open sesam', 'open sesame')).toBe(false);
    expect(await codeMatches('', 'open sesame')).toBe(false);
  });

  it('sets a cookie scripts can’t read and other sites can’t send', () => {
    const cookie = accessCookie('123.abc');
    for (const attr of [
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${ACCESS_MAX_AGE_S}`,
    ]) {
      expect(cookie).toContain(attr);
    }
  });
});
