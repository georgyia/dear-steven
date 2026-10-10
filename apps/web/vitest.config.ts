import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: { name: 'web', include: ['src/**/*.test.ts'], environment: 'node' },
});
