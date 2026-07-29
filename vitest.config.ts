import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['lib/scoring/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
