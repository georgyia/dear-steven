import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'ingest', include: ['src/**/*.test.ts'], environment: 'node' },
});
