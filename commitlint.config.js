// Conventional Commits with an allow-listed scope (plan/06-workflow.md §2).
// CI lints the PR title, which becomes the squash commit.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'core',
        'ingest',
        'design',
        'voice',
        'eval',
        'docs',
        'plan',
        'ci',
        'infra',
        'deps',
        'repo',
        'harness',
        'security',
      ],
    ],
    'subject-case': [0],
  },
};
