import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'lib/**/*.test.ts', 'lib/**/*.test.tsx', 'ingest/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.join(process.cwd(), '.'),
    },
  },
});
