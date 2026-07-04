/**
 * Live projection from the ACTUAL current state (R32 done, R16+ remaining).
 * The sim randomizes every unplayed match via the Poisson model, so upsets are
 * fully in play — this is not a favorites-only read. Reports each contender's
 * P(win), P(top3), P(top5), current rank and expected finish.
 */
import { runSims, buildRows } from '../sim-core'
import { tournamentResults } from '../src/tournament-results'
import type { PredictionsState } from '../src/shared/types'

const played: PredictionsState = {}
for (const matches of Object.values(tournamentResults.groupMatches))
  for (const m of matches)
    if (m.scores && m.scores.home != null && m.scores.away != null) played[m.id] = m.scores
const ks = tournamentResults.knockoutStages
for (const round of [ks.r32, ks.r16, ks.qf, ks.sf, ks.thirdPlace, ks.final])
  for (const m of round)
    if (m.scores && m.scores.home != null && m.scores.away != null) played[String(m.matchNum)] = m.scores

const playerGoals = tournamentResults.playerGoals ?? {}
const N = Number(process.argv[2] ?? 20000)
console.log(`played matches: ${Object.keys(played).length}; N=${N}`)

const real = runSims(played, N, 4242, true, playerGoals)
const rows = buildRows(real, N, played, playerGoals)  // sorted by winPct

console.log('\n#  name'.padEnd(26), 'cur'.padStart(4), 'win%'.padStart(7), 'top3%'.padStart(7), 'top5%'.padStart(7), 'xPts'.padStart(6), 'xRank'.padStart(6), 'champ'.padStart(12))
rows.forEach((r, i) => {
  if (i < 8 || r.label === 'ליאור מולדובן') console.log(
    `${String(i + 1).padStart(2)} ${r.label}`.padEnd(26),
    String(r.curRank).padStart(4),
    r.winPct.toFixed(1).padStart(7),
    r.top3Pct.toFixed(1).padStart(7),
    r.top5Pct.toFixed(1).padStart(7),
    r.avgPts.toFixed(0).padStart(6),
    r.expRank.toFixed(1).padStart(6),
    r.championHe.padStart(12),
  )
})

const lior = rows.find(r => r.label === 'ליאור מולדובן')!
console.log(`\n>>> ליאור: מקום נוכחי ${lior.curRank}, P(win)=${lior.winPct.toFixed(1)}%, P(top3)=${lior.top3Pct.toFixed(1)}%, P(top5)=${lior.top5Pct.toFixed(1)}%, אלופה שבחר: ${lior.championHe} (alive=${lior.championAlive})`)
