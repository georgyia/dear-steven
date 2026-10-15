import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The deployment's committed configuration (P10-03) agrees with the image and the app: `fly.toml`
 * sends traffic to the port the image listens on, mounts the volume where the image keeps its
 * data, and checks the health route that exists. And `docs/DEPLOY.md` lists every variable the
 * web server reads.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

type Table = { [key: string]: Value };
type Value = string | number | boolean | Table | Table[];

/**
 * A strict reader for the part of TOML that `fly.toml` uses: comments, `[tables]`,
 * `[[arrays.of.tables]]` and `key = "string" | integer | boolean`. Anything else, or a key or
 * table defined twice, fails the test rather than being skipped.
 */
function parseToml(text: string): Table {
  const root: Table = {};
  const defined = new Set<string>();
  let table = root;
  const at = (path: string[]): Table =>
    path.reduce<Table>((parent, key) => {
      const next = parent[key] ?? {};
      if (Array.isArray(next)) return next[next.length - 1] as Table;
      if (typeof next !== 'object') throw new Error(`${key} is a value, not a table`);
      parent[key] = next;
      return next;
    }, root);
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/^([^"#]*("[^"\\]*"[^"#]*)*)#.*$/, '$1').trim();
    const fail = (why: string) => new Error(`fly.toml:${i + 1}: ${why}: ${raw}`);
    if (!line) return;
    let m = /^\[\[([a-z_]+(?:\.[a-z_]+)*)\]\]$/.exec(line);
    if (m?.[1]) {
      const path = m[1].split('.');
      const parent = at(path.slice(0, -1));
      const key = path[path.length - 1] as string;
      const list = parent[key] ?? [];
      if (!Array.isArray(list)) throw fail('already a table');
      list.push({});
      parent[key] = list;
      table = list[list.length - 1] as Table;
      return;
    }
    m = /^\[([a-z_]+(?:\.[a-z_]+)*)\]$/.exec(line);
    if (m?.[1]) {
      if (defined.has(m[1])) throw fail('table defined twice');
      defined.add(m[1]);
      table = at(m[1].split('.'));
      return;
    }
    m = /^([A-Za-z0-9_-]+) = ("[^"\\]*"|-?[0-9]+|true|false)$/.exec(line);
    if (!m?.[1] || m[2] === undefined) throw fail('not TOML this check reads');
    if (Object.hasOwn(table, m[1])) throw fail('key defined twice');
    const value = m[2];
    table[m[1]] = value.startsWith('"')
      ? value.slice(1, -1)
      : value === 'true' || value === 'false'
        ? value === 'true'
        : Number(value);
  });
  return root;
}

const fly = parseToml(read('fly.toml'));
const dockerfile = read('Dockerfile');
const service = fly.http_service as Table;
const env = fly.env as Table;

/** The last value the run stage gives `name` (`ENV` lines continue with backslashes). */
const imageEnv = (name: string) =>
  [...dockerfile.matchAll(new RegExp(`\\b${name}=(\\S+)`, 'g'))].at(-1)?.[1];

describe('fly.toml (P10-03)', () => {
  it('reads as TOML, and names an app and a region for the owner to change', () => {
    expect(fly.app).toEqual(expect.any(String));
    expect(fly.primary_region).toEqual(expect.any(String));
  });

  it('sends traffic to the port the image listens on, over HTTPS only', () => {
    expect(service.internal_port).toBe(Number(imageEnv('PORT')));
    expect(dockerfile).toMatch(new RegExp(`^EXPOSE ${service.internal_port}$`, 'm'));
    expect(service.force_https).toBe(true);
  });

  it('mounts the volume where the image keeps the knowledge base and its files', () => {
    const mounts = fly.mounts as Table;
    expect(dockerfile).toContain(`VOLUME ["${mounts.destination}"]`);
    expect(dirname(String(imageEnv('DEAR_STEVEN_DB_PATH')))).toBe(mounts.destination);
    expect(dirname(String(env.DEAR_STEVEN_DB_PATH))).toBe(mounts.destination);
  });

  it('checks the health route the app serves, as the image does', () => {
    const [check, ...more] = service.checks as Table[];
    expect(more).toEqual([]);
    expect(check).toMatchObject({ method: 'GET', path: '/api/health' });
    expect(existsSync(join(ROOT, 'apps/web/src/app/api/health/route.ts'))).toBe(true);
    expect(dockerfile).toContain(
      `fetch('http://127.0.0.1:${service.internal_port}${String(check?.path)}')`,
    );
  });

  it('keeps one machine running, never stopped when idle', () => {
    expect(service.auto_stop_machines).toBe('off');
    expect(service.min_machines_running).toBe(1);
  });

  it('holds no secrets', () => {
    for (const secret of ['OPENAI_API_KEY', 'DEAR_STEVEN_ACCESS_CODE', 'YOUTUBE_API_KEY']) {
      expect(Object.keys(env)).not.toContain(secret);
    }
    expect(read('fly.toml')).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });
});

describe('docs/DEPLOY.md (P10-03)', () => {
  /** Every variable named in the web server's and core's source, tests aside. */
  function variablesInSource(): Set<string> {
    const names = new Set<string>();
    const scan = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
          for (const [name] of read(path).matchAll(
            /\b(?:DEAR_STEVEN|OPENAI|YOUTUBE)_[A-Z0-9_]+\b/g,
          )) {
            names.add(name);
          }
        }
      }
    };
    for (const dir of ['apps/web/src', 'packages/core/src']) scan(dir);
    for (const [name] of read('apps/web/next.config.ts').matchAll(/\bDEAR_STEVEN_[A-Z0-9_]+\b/g)) {
      names.add(name);
    }
    return names;
  }

  it('lists every variable the web server reads in its table', () => {
    const doc = read('docs/DEPLOY.md');
    const table = doc.slice(
      doc.indexOf('## Variables'),
      doc.indexOf('\n## ', doc.indexOf('## Variables') + 1),
    );
    const found = variablesInSource();
    expect(found.size).toBeGreaterThan(10);
    // Read by the OpenAI SDK itself, from the environment, on every client this app makes.
    for (const sdk of ['OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID']) found.add(sdk);
    expect([...found].filter((name) => !table.includes(`\`${name}\``))).toEqual([]);
  });
});
