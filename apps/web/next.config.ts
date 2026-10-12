import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// The keys live in the repository-root .env, shared with the ingest CLI and the eval harness;
// Next itself only reads apps/web/.env*. Variables already in the environment win (Node's loader
// never overrides them), so the e2e suite's DEAR_STEVEN_DEMO=1 still forces demo mode. In Docker
// there is no .env: the platform sets the variables.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // One deployable unit: `output: 'standalone'` runs in a single Docker container (ADR-001).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // The stage is one client tree; we do not opt into Cache Components / PPR.
  cacheComponents: false,
  // Native SQLite + the sqlite-vec loadable extension must stay out of the bundle.
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
  // sqlite-vec finds its platform binary with import.meta.resolve at runtime, which tracing can't
  // see; ship every platform package so the standalone build (Docker) can load vec0.
  outputFileTracingIncludes: {
    '/**': ['../../node_modules/.pnpm/sqlite-vec@*/node_modules/sqlite-vec-*/**/*'],
  },
  transpilePackages: ['@dear-steven/core'],
  poweredByHeader: false,
  // The repository's own AGENTS.md is the agent contract; don't generate a second one here.
  agentRules: false,
  devIndicators: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Microphone is requested only from this origin, only on a user gesture.
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
          // Content-Security-Policy and HSTS are set per request in src/proxy.ts: the script
          // nonce has to be fresh for every page (P6-09).
        ],
      },
    ];
  },
};

export default nextConfig;
