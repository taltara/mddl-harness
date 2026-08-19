import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The store and storage layer touch localStorage and crypto.randomUUID.
    environment: 'jsdom',
    // jsdom's localStorage depends on the document origin and has moved
    // between versions; the setup file supplies a deterministic one.
    setupFiles: ['src/test/setup.ts'],
  },
})
