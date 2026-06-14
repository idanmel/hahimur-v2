import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // The bundle is mostly prediction data that gzips ~7:1 (~124 kB on the wire)
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    pool: 'threads',
    // userEvent-driven tests finish in well under a second solo, but the
    // default 5s ceiling gets starved when the whole suite runs in parallel.
    // Give headroom for scheduling contention — a genuine hang still fails.
    testTimeout: 15000,
  },
})
