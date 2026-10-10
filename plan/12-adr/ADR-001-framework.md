# ADR-001 — Next.js 16 as a thin server shell around one client stage

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | P0-02, P1-*, P3-05 |

**Decision owner:** human (approved with the plan) · **Supersedes:** —

## Context

The product is one immersive page with streaming answers, plus a handful of server routes that
hold secrets. One developer; one deployable unit preferred.

## Options

1. **Next.js 16** (App Router, route handlers, Turbopack).
2. React Router 7 (framework mode).
3. Vite SPA + Hono API (two processes or a custom server).

## Decision

Next.js 16.4 with React 19.3. Server components only for the layout, fonts and the first status
read; the whole stage is one client tree. Route handlers do validation, rate limiting and SSE
transport and call `packages/core` for everything else. `output: 'standalone'` for Docker;
`cacheComponents: false`; `serverExternalPackages: ['better-sqlite3', 'sqlite-vec']`;
`agentRules: false` (our AGENTS.md is the contract). TypeScript stays on 6.x: TypeScript 7's
package no longer exposes the compiler API `next build` uses.

## Consequences

- `'use client'` discipline; canvas/WebGL components via `next/dynamic({ ssr: false })`.
- SSE over a `fetch` POST with our own ~60-line parser (no EventSource; POST bodies needed).
- Vercel is not a target while storage is a local SQLite file.

## Revisit when

RSC friction costs more than it saves (fallback: React Router 7), or we need multi-instance hosting.
