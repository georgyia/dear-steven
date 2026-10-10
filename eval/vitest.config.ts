import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'eval',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
  },
});
