/**
 * CLI win-probability report (offline / static HTML).
 *
 * Uses the locally-edited played-results.ts. For a LIVE auto-updating version
 * that pulls real results on every refresh, run the server instead:
 *   npx tsx server.ts   (or double-click serve-live.bat)
 *
 * Run:  npx tsx winprob.ts [numSims] [seed]
 */
import { writeFileSync } from 'node:fs'
import { runSims, buildRows, buildHtml, describePlayed, currentResults } from './sim-core'
import { USERS } from './src/users'
import { computeUserPoints } from './src/leaderboard/points'
import { PLAYED } from './played-results'
import type { PredictionsState } from './src/shared/types'

const N = Number(process.argv[2]) || 5000
const SEED = Number(process.argv[3]) || 12345

console.log(`Running ${N} simulations over ${USERS.length} contestants...`)
const t0 = Date.now()
const real = runSims(PLAYED, N, SEED, true)
const rows = buildRows(real, N, PLAYED)
const secs = ((Date.now() - t0) / 1000).toFixed(1)

// current standings (validation)
const cur = currentResults(PLAYED)
const curScores = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, cur).total }))
  .sort((a, b) => b.pts - a.pts)

console.log(`\nDone in ${secs}s.\n`)
console.log('Current standings (match points only):')
curScores.slice(0, 8).forEach((s, i) => console.log(`  ${i + 1}. ${s.label}: ${s.pts}`))

console.log('\n=== WIN PROBABILITY (Monte Carlo) ===')
rows.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(2)}.  ${r.label.padEnd(28)}${r.winPct.toFixed(1).padStart(5)}%  top3 ${r.top3Pct.toFixed(1).padStart(5)}%  avg ${r.avgPts.toFixed(0)}  now ${r.curRank}`)
})

// optional Turkey-impact diagnostic (counterfactual: D2 not played)
if (PLAYED['D2']) {
  const noTurkey: PredictionsState = { ...PLAYED }
  delete noTurkey['D2']
  const cf = runSims(noTurkey, N, SEED)
  console.log('\n=== Turkey impact (Δ = real − counterfactual) ===')
  rows.slice(0, 8).forEach(r => {
    const cfPct = (cf.win.get(r.label)! / N) * 100
    const d = r.winPct - cfPct
    console.log(`  ${r.label.padEnd(28)} real ${r.winPct.toFixed(1)}%  cf ${cfPct.toFixed(1)}%  Δ ${d >= 0 ? '+' : ''}${d.toFixed(1)}%`)
  })
}

const html = buildHtml(rows, { n: N, playedList: describePlayed(PLAYED), updatedAt: new Date() })
const outPath = new URL('./winprob.html', import.meta.url)
writeFileSync(outPath, html, 'utf-8')
console.log(`\nHTML report: ${decodeURIComponent(outPath.pathname.replace(/^\//, ''))}`)
