import { defineConfig } from 'vitest/config'
import type { PluginOption, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'

// Dev-only: serve the real api/live-scores.ts handler under `npm run dev`, since
// Vite alone doesn't run Vercel functions. Production/CI are unaffected — this
// runs only inside `configureServer`. Lets the live overlay be tested locally.
function devLiveScoresApi(): PluginOption {
  return {
    name: 'dev-live-scores-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/live-scores', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const handler = (await server.ssrLoadModule('/api/live-scores.ts')).default
          const vRes = {
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status(code: number) { res.statusCode = code; return this },
            json(body: unknown) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
              return this
            },
          }
          await handler({ method: req.method, query: Object.fromEntries(url.searchParams) }, vRes)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ events: [], error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devLiveScoresApi()],
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
