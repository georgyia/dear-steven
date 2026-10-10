import { describe, expect, it } from 'vitest';
import { arrivedOverHttps, contentSecurityPolicy, newNonce } from './csp';

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split('; ').map((d) => {
      const [name, ...values] = d.split(' ');
      return [name, values.join(' ')];
    }),
  );

describe('contentSecurityPolicy', () => {
  const prod = directives(contentSecurityPolicy({ nonce: 'abc123', dev: false, https: true }));

  it('runs scripts only with the nonce, never inline or eval', () => {
    expect(prod['script-src']).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod['script-src']).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it('keeps every fetch, font and image on this origin', () => {
    expect(prod['default-src']).toBe("'self'");
    expect(prod['connect-src']).toBe("'self'");
    expect(prod['font-src']).toBe("'self'");
    expect(prod['img-src']).toBe("'self' data: blob:");
  });

  it('allows only the click-to-load YouTube player and https podcast audio from elsewhere', () => {
    expect(prod['frame-src']).toBe('https://www.youtube-nocookie.com');
    expect(prod['media-src']).toBe("'self' https:");
    expect(prod['object-src']).toBe("'none'");
    expect(prod['frame-ancestors']).toBe("'none'");
    expect(prod['base-uri']).toBe("'self'");
    expect(prod['form-action']).toBe("'self'");
  });

  it('upgrades insecure requests only over HTTPS, and reports only in development', () => {
    expect(prod).toHaveProperty('upgrade-insecure-requests');
    expect(prod).not.toHaveProperty('report-uri');
    const local = directives(contentSecurityPolicy({ nonce: 'n', dev: true, https: false }));
    expect(local).not.toHaveProperty('upgrade-insecure-requests');
    expect(local['report-uri']).toBe('/api/csp-report');
    expect(local['script-src']).toBe("'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'");
  });
});

describe('newNonce', () => {
  it('is 128 bits of base64 and never repeats', () => {
    const seen = new Set(Array.from({ length: 1000 }, newNonce));
    expect(seen.size).toBe(1000);
    for (const n of seen) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe('arrivedOverHttps', () => {
  const url = (u: string) => new URL(u);
  it('trusts the forwarded protocol from a TLS-terminating proxy', () => {
    expect(
      arrivedOverHttps(new Headers({ 'x-forwarded-proto': 'https' }), url('http://app/')),
    ).toBe(true);
    expect(
      arrivedOverHttps(new Headers({ 'x-forwarded-proto': 'https, http' }), url('http://app/')),
    ).toBe(true);
    expect(
      arrivedOverHttps(new Headers({ 'x-forwarded-proto': 'http' }), url('https://app/')),
    ).toBe(false);
  });
  it('falls back to the request URL', () => {
    expect(arrivedOverHttps(new Headers(), url('https://app/'))).toBe(true);
    expect(arrivedOverHttps(new Headers(), url('http://localhost:3000/'))).toBe(false);
  });
});
