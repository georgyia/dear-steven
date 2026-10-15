import { describe, expect, it } from 'vitest';
import { fromAnotherSite } from './cross-site';

const post = (headers: Record<string, string>, method = 'POST') => ({
  method,
  headers: new Headers({ host: 'steven.example', ...headers }),
});

describe('fromAnotherSite (P8-08)', () => {
  it('refuses what Fetch Metadata says came from another site', () => {
    expect(fromAnotherSite(post({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    // A sibling subdomain is another site's page too.
    expect(fromAnotherSite(post({ 'sec-fetch-site': 'same-site' }))).toBe(true);
    // Fetch Metadata wins over an Origin that looks like ours.
    expect(
      fromAnotherSite(post({ 'sec-fetch-site': 'cross-site', origin: 'https://steven.example' })),
    ).toBe(true);
  });

  it('lets this site’s own pages through', () => {
    expect(fromAnotherSite(post({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(fromAnotherSite(post({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(fromAnotherSite(post({ origin: 'https://steven.example' }))).toBe(false);
    expect(fromAnotherSite(post({ origin: 'https://steven.example:443' }))).toBe(false);
  });

  it('without Fetch Metadata, compares Origin with the host', () => {
    expect(fromAnotherSite(post({ origin: 'https://attacker.example' }))).toBe(true);
    expect(fromAnotherSite(post({ origin: 'https://steven.example:8443' }))).toBe(true);
    expect(fromAnotherSite(post({ origin: 'https://steven.example.attacker.example' }))).toBe(true);
    // Sandboxed frames and some redirects send `null`; anything unreadable is refused too.
    expect(fromAnotherSite(post({ origin: 'null' }))).toBe(true);
    expect(fromAnotherSite(post({ origin: 'not a url' }))).toBe(true);
  });

  it('takes the host a proxy in front says the browser asked for', () => {
    const behind = (origin: string) =>
      fromAnotherSite({
        method: 'POST',
        headers: new Headers({
          host: '127.0.0.1:3000',
          'x-forwarded-host': 'steven.example',
          origin,
        }),
      });
    expect(behind('https://steven.example')).toBe(false);
    expect(behind('https://attacker.example')).toBe(true);
  });

  it('lets reads, and requests that aren’t from a page, through', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(fromAnotherSite(post({ 'sec-fetch-site': 'cross-site' }, method)), method).toBe(false);
    }
    // A script or curl sends neither header: no one's browser is borrowed.
    expect(fromAnotherSite(post({}))).toBe(false);
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect(fromAnotherSite(post({ 'sec-fetch-site': 'cross-site' }, method)), method).toBe(true);
    }
  });
});
