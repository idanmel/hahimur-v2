/**
 * Local live win-probability server.
 *
 * Each page load pulls real WC2026 results (openfootball), and re-runs the
 * Monte-Carlo simulation when the results have changed (or when you click
 * "refresh now"). Open http://localhost:5173 and refresh anytime.
 *
 * Run:  npx tsx server.ts        (or: double-click serve-live.bat)
 * Env:  SIMS=3000  PORT=5173
 */
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runSims, buildRows, buildHtml, describePlayed } from './sim-core'
import { fetchLivePlayed, type LiveResult } from './live-results'
import { buildHistory, buildHistoryHtml } from './history'

const N = Number(process.env.SIMS) || 3000
const HIST_N = Number(process.env.HIST_SIMS) || 2000
const PORT = Number(process.env.PORT) || 5173
const SEED = 12345
const FETCH_TTL_MS = 15_000
const HISTORY_FILE = join(process.cwd(), 'history.json')

let lastLive: LiveResult | null = null
let lastFetchAt = 0
let cache: { html: string; key: string } | null = null
let histCache: { html: string; key: string } | null = null

async function getLive(force: boolean): Promise<LiveResult> {
  if (force || !lastLive || Date.now() - lastFetchAt > FETCH_TTL_MS) {
    lastLive = await fetchLivePlayed()
    lastFetchAt = Date.now()
  }
  return lastLive
}

const server = createServer(async (req, res) => {
  if (req.url && /^\/favicon/.test(req.url)) { res.writeHead(204); res.end(); return }
  const path = (req.url ?? '/').split('?')[0]
  const force = !!req.url && req.url.includes('?t=')
  try {
    const live = await getLive(force)

    if (path === '/history') {
      const key = JSON.stringify(live.order.map(f => [f.id, f.scores]))
      if (!histCache || histCache.key !== key) {
        const t0 = Date.now()
        const snaps = buildHistory(live.order, HIST_N, SEED)
        writeFileSync(HISTORY_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), sims: HIST_N, snapshots: snaps }, null, 2), 'utf-8')
        const html = buildHistoryHtml(snaps, { n: HIST_N, updatedAt: new Date(), live: true })
        histCache = { html, key }
        console.log(`[${new Date().toLocaleTimeString('he-IL')}] rebuilt history (${snaps.length} steps × ${HIST_N} sims) in ${((Date.now() - t0) / 1000).toFixed(1)}s → history.json`)
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(histCache.html)
      return
    }

    const key = JSON.stringify(live.played)
    if (!cache || cache.key !== key || force) {
      const t0 = Date.now()
      const real = runSims(live.played, N, SEED, true)
      const rows = buildRows(real, N, live.played)
      const html = buildHtml(rows, {
        n: N,
        playedList: describePlayed(live.played),
        updatedAt: new Date(),
        live: true,
        source: live.source,
        historyHref: '/history',
      })
      cache = { html, key }
      console.log(`[${new Date().toLocaleTimeString('he-IL')}] re-ran ${N} sims in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${live.count} matches played`)
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(cache.html)
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('שגיאה במשיכת תוצאות: ' + (e as Error).message)
  }
})

server.listen(PORT, () => {
  console.log(`\n  שרת הסתברות זכייה (לייב) רץ כאן:  http://localhost:${PORT}\n`)
  console.log(`  כל רענון מושך תוצאות אמת (openfootball) ומריץ מחדש כשמשהו משתנה.`)
  console.log(`  סימולציות לרענון: ${N} (שנה עם SIMS=...)\n`)
})
