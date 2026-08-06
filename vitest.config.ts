import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: [
      'lib/scoring/__tests__/**/*.test.ts',
      'lib/__tests__/**/*.test.ts',
      'lib/graph/__tests__/**/*.test.ts',
      'lib/wizard/__tests__/**/*.test.ts',
      'app/api/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    globals: false,
  },
})
