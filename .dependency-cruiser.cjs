/**
 * Architecture fitness rules (docs/ARCHITECTURE.md §2). Run with `pnpm arch`; CI runs it inside
 * `pnpm check`. A violation here is a design bug, not a lint nit.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-is-framework-free',
      comment: 'packages/core holds every domain decision and must not depend on a UI framework.',
      severity: 'error',
      from: { path: '^packages/core/' },
      // Matches both resolved (node_modules/react/…) and unresolvable ('react') imports.
      to: { path: ['(^|node_modules/)(next|react|react-dom|motion)(/|$)', '^apps/'] },
    },
    {
      name: 'core-does-not-know-the-cli',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^packages/ingest/' },
    },
    {
      name: 'ingest-does-not-know-the-web',
      severity: 'error',
      from: { path: '^packages/ingest/' },
      to: { path: '^apps/' },
    },
    {
      name: 'client-never-imports-server-core',
      comment:
        'Client components may only use the pure, browser-safe core entry points (schema, youtube, format).',
      severity: 'error',
      from: { path: '^apps/web/src/components/' },
      to: {
        path: '^packages/core/src/(store|retrieval|answer|interview|ingest|openai|config)/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.next/', 'components/vendor/react-bits/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
    },
  },
};
