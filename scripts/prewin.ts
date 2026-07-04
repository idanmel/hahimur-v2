/**
 * Pre-tournament win-probability run (empty `played`), to test the claim that
 * one bettor's P(win) was an outlier before a ball was kicked — and, crucially,
 * WHETHER that comes from raw quality (also top on expected points) or from
 * field-aware DIFFERENTIATION (high win% while only middling on expected points
 * and low similarity to the strong crowd). The latter is the fingerprint of a
 * form built to beat THIS specific field (needs to have seen the forms).
 */
import { runSims, buildRows } from '../sim-core'
import { USERS } from '../src/users'

const N = Number(process.argv[2] ?? 20000)
const SEED = 12345
const real = runSims({}, N, SEED, true, {})
const rows = buildRows(real, N, {}, {})

// rank helpers
const byWin = [...rows].sort((a, b) => b.winPct - a.winPct)
const byPts = [...rows].sort((a, b) => b.avgPts - a.avgPts)
const byCeil = [...rows].sort((a, b) => b.ceiling - a.ceiling)
const winRank = new Map(byWin.map((r, i) => [r.label, i + 1]))
const ptsRank = new Map(byPts.map((r, i) => [r.label, i + 1]))
const ceilRank = new Map(byCeil.map((r, i) => [r.label, i + 1]))

const avgWin = 100 / rows.length
console.log(`\nN=${N} sims, pre-tournament (nothing played). avg win% = ${avgWin.toFixed(2)}%\n`)
console.log('#  name'.padEnd(26), 'win%'.padStart(7), 'xPts'.padStart(7), 'σ'.padStart(6), 'P95'.padStart(6), 'ptsRk'.padStart(6), 'gap'.padStart(5), 'champ'.padStart(13))
byWin.forEach((r, i) => {
  const gap = ptsRank.get(r.label)! - winRank.get(r.label)!   // + = wins more than its points-rank => differentiated
  console.log(
    `${String(i + 1).padStart(2)} ${r.label}`.padEnd(26),
    r.winPct.toFixed(2).padStart(7),
    r.avgPts.toFixed(0).padStart(7),
    r.std.toFixed(0).padStart(6),
    r.ceiling.toFixed(0).padStart(6),
    String(ptsRank.get(r.label)).padStart(6),
    (gap >= 0 ? '+' : '') + gap,
    r.championHe.padStart(13),
  )
})

const lead = byWin[0]
const second = byWin[1]
console.log(`\nLEADER: ${lead.label} — win% ${lead.winPct.toFixed(2)} (next: ${second.label} ${second.winPct.toFixed(2)}); ratio ${(lead.winPct / second.winPct).toFixed(2)}x, vs field avg ${(lead.winPct / avgWin).toFixed(2)}x`)
console.log(`points-rank of leader: ${ptsRank.get(lead.label)} of ${rows.length}; ceiling-rank: ${ceilRank.get(lead.label)}`)
