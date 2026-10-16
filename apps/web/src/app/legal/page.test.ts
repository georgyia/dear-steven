import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_PENDING, OPERATOR, OPERATOR_PENDING, type Operator } from '@/content/policies';

vi.mock('@/server/locale', () => ({ requestUiLocale: async () => 'en' }));

/** The page as the server renders it, with whatever `@/content/policies` holds at the time. */
async function legalPage(): Promise<string> {
  const { default: LegalPage } = await import('./page');
  return renderToStaticMarkup(await LegalPage());
}

const SAMPLE: Operator = {
  name: 'Erika Example',
  address: ['Example Street 1', '12345 Example Town', 'Germany'],
  email: 'erika@example.org',
};

describe('the legal notice (#116)', () => {
  afterEach(() => {
    vi.doUnmock('@/content/policies');
    vi.resetModules();
  });

  it('says the operator and the contact are still to come, while they are not set', async () => {
    expect(OPERATOR).toBeNull();
    const html = await legalPage();
    expect(html).toContain('<h1');
    expect(html).toContain('Legal notice');
    expect(html).toContain(`<p lang="en">${OPERATOR_PENDING}</p>`);
    expect(html).toContain(`<p lang="en">${CONTACT_PENDING}</p>`);
    expect(html).not.toContain('<address');
    expect(html).toContain('href="/terms"');
  });

  it('shows the operator’s name, address and email once they are set', async () => {
    vi.doMock('@/content/policies', async (original) => ({
      ...(await original<typeof import('@/content/policies')>()),
      OPERATOR: SAMPLE,
      CONTACT: 'takedown@example.org',
    }));
    const html = await legalPage();
    expect(html).toContain('<address');
    for (const line of [SAMPLE.name, ...SAMPLE.address]) expect(html).toContain(line);
    expect(html).toContain(`<a href="mailto:${SAMPLE.email}"`);
    expect(html).toContain('takedown@example.org');
    expect(html).not.toContain('TODO (owner)');
  });
});
