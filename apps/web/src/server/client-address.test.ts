import { describe, expect, it } from 'vitest';
import { clientAddress, normaliseAddress } from './client-address';

const from = (headers: Record<string, string>) =>
  new Request('https://dear-steven.example/api/ask', { headers });

describe('the client address (P8-01)', () => {
  it('is the hop this deployment appended, not the one the client wrote', () => {
    // The client claims 1.2.3.4; the one proxy in front appends what it really saw.
    const req = from({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });
    expect(clientAddress(req, { header: null, trustedProxies: 1 })).toBe('203.0.113.9');
  });

  it('skips as many hops as there are trusted proxies', () => {
    const req = from({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7, 10.0.0.2' });
    expect(clientAddress(req, { header: null, trustedProxies: 2 })).toBe('198.51.100.7');
    // Fewer hops than proxies: the first one is all there is.
    expect(clientAddress(req, { header: null, trustedProxies: 5 })).toBe('1.2.3.4');
  });

  it('uses only the platform header when one is configured', () => {
    const req = from({ 'fly-client-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4' });
    expect(clientAddress(req, { header: 'fly-client-ip', trustedProxies: 1 })).toBe('203.0.113.9');
    expect(
      clientAddress(from({ 'x-forwarded-for': '1.2.3.4' }), {
        header: 'fly-client-ip',
        trustedProxies: 1,
      }),
    ).toBe('unknown');
  });

  it('is "unknown" rather than whatever text was sent', () => {
    const policy = { header: null, trustedProxies: 1 };
    expect(clientAddress(from({}), policy)).toBe('unknown');
    expect(clientAddress(from({ 'x-forwarded-for': 'all' }), policy)).toBe('unknown');
    expect(clientAddress(from({ 'x-forwarded-for': '1.2.3.4, <script>' }), policy)).toBe('unknown');
  });
});

describe('normaliseAddress', () => {
  it('keeps IPv4 addresses and drops ports', () => {
    expect(normaliseAddress('203.0.113.9')).toBe('203.0.113.9');
    expect(normaliseAddress('203.0.113.9:51234')).toBe('203.0.113.9');
    expect(normaliseAddress('::ffff:203.0.113.9')).toBe('203.0.113.9');
  });

  it('counts IPv6 by its /64', () => {
    expect(normaliseAddress('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(normaliseAddress('2001:0DB8:0001:0002:ffff:0:0:9')).toBe('2001:db8:1:2::/64');
    expect(normaliseAddress('[2001:db8:1:2::9]:443')).toBe('2001:db8:1:2::/64');
    expect(normaliseAddress('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(normaliseAddress('::1')).toBe('0:0:0:0::/64');
    expect(normaliseAddress('64:ff9b::192.0.2.1')).toBe('64:ff9b:0:0::/64');
  });

  it('refuses anything that is not an address', () => {
    for (const bad of ['', 'local', '256.1.1.1', '01.2.3.4', '1.2.3', '2001:db8::1::2', 'g::1']) {
      expect(normaliseAddress(bad)).toBe(null);
    }
    expect(normaliseAddress('1:2:3:4:5:6:7:8:9')).toBe(null);
    expect(normaliseAddress(undefined)).toBe(null);
  });
});
