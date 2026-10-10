# H-02 — Harness decisions

**Unblocks:** P0-05 (third-party skills)
**Start when:** any time

## Decide yes/no

| Item | Default if declined |
|------|---------------------|
| Install third-party skills into `.agents/skills/` (testing-best-practices, clean-code-skills, trailofbits security skills, anthropic frontend-design / webapp-testing, vercel react best practices) — each read and audited before commit | Only the project skills (`dear-steven-*`) are present; the matrix falls back to `docs/` |
| Playwright MCP server in `.mcp.json` for agents to drive the browser | Agents use the Playwright test runner and screenshots |
| Context7 (library docs MCP) | Agents read `node_modules/next/dist/docs/` and package types |
| GitHub MCP with a repo-scoped token | Agents keep using the `gh` CLI |
| GitHub Advanced Security | gitleaks in CI (already on) |

## Tell the agent

> H-02 done. Third-party skills: yes/no (which). Playwright MCP: yes/no. Context7: yes/no. GitHub MCP: yes/no. GHAS: yes/no.
