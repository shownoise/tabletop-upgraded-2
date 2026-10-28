import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Zie test-stubs/server-only.ts: zonder deze regel gooit het echte
      // pakket in elke test die lib/db.ts aanraakt.
      'server-only': path.resolve(__dirname, 'test-stubs/server-only.ts'),
    },
  },
  test: {
    include: [
      'lib/scoring/__tests__/**/*.test.ts',
      'lib/__tests__/**/*.test.ts',
      'lib/graph/__tests__/**/*.test.ts',
      'lib/wizard/__tests__/**/*.test.ts',
      'app/api/__tests__/**/*.test.ts',
      // Zonder deze regel liepen de tests onder components/ niet mee en bleven
      // ze ongemerkt rood; de deelnemer-stapflow test hier zijn rolafleiding.
      'components/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    globals: false,
  },
})
