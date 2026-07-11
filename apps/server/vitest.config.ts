import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@sessionmap/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
})
