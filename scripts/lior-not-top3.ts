/**
 * Enumerate the scenarios in which ליאור does NOT finish top-3.
 * Runs the same Monte-Carlo the live board uses, then — restricted to the sims
 * where Lior lands 4th or worse — reports what actually happened: who overtook
 * him, who was champion / third-place winner, and what became of the teams he
 * backed (France champion, France/England in the final).
 */
import { simulateTournament, realGamesByTeam, he } from '../sim-core'
import { computeUserPoints } from '../src/leaderboard/points'
import { USERS } from '../src/users'
import { tournamentResults } from '../src/tournament-results'
import type { PredictionsState } from '../src/shared/types'

const LIOR = 'ליאור מולדובן'

// Reconstruct the played state (group + KO) exactly like scripts/live-top3.ts.
const played: PredictionsState = {}
for (const matches of Object.values(tournamentResults.groupMatches))
  for (const m of matches)
    if (m.scores && m.scores.home != null && m.scores.away != null) played[m.id] = m.scores
const ks0 = tournamentResults.knockoutStages
for (const round of [ks0.r32, ks0.r16, ks0.qf, ks0.sf, ks0.thirdPlace, ks0.final])
  for (const m of round)
    if (m.scores && m.scores.home != null && m.scores.away != null) played[String(m.matchNum)] = m.scores

const realGoals = tournamentResults.playerGoals ?? {}
const realGames = realGamesByTeam(played)
const N = Number(process.argv[2] ?? 200000)
const SEED = 4242

const others = USERS.filter(u => u.label !== LIOR)

let notTop3 = 0, notTop5 = 0
const beat = new Map<string, number>(others.map(u => [u.label, 0]))     // finished above Lior | notTop3
const champ = new Map<string, number>()                                 // champion            | notTop3
const third = new Map<string, number>()                                 // 3rd-place winner    | notTop3
const finalists = new Map<string, number>()                             // reached final       | notTop3
let franceChampInNotTop3 = 0, franceFinalInNotTop3 = 0, englandFinalInNotTop3 = 0
const aboveCount = new Map<number, number>()                            // how many finished above Lior

// simulateTournament draws from sim-core's module-local RNG, which initialises
// deterministically at process start — so a fresh run is reproducible without
// needing the (unexported) reseed. N is large enough that the tail is stable.
for (let i = 0; i < N; i++) {
  const res = simulateTournament(played, realGoals, realGames)
  const scored = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, res).total }))
  const myPts = scored.find(s => s.label === LIOR)!.pts
  const above = scored.filter(s => s.label !== LIOR && s.pts > myPts)
  const rank = above.length + 1

  if (rank > 5) notTop5++
  if (rank <= 3) continue
  notTop3++
  aboveCount.set(above.length, (aboveCount.get(above.length) ?? 0) + 1)
  for (const a of above) beat.set(a.label, (beat.get(a.label) ?? 0) + 1)
  if (res.champion) champ.set(res.champion, (champ.get(res.champion) ?? 0) + 1)
  if (res.thirdPlaceWinner) third.set(res.thirdPlaceWinner, (third.get(res.thirdPlaceWinner) ?? 0) + 1)
  const fin = res.knockoutStages.final[0]
  for (const t of [fin?.home, fin?.away]) if (t) finalists.set(t, (finalists.get(t) ?? 0) + 1)
  if (res.champion === 'France') franceChampInNotTop3++
  if (fin && (fin.home === 'France' || fin.away === 'France')) franceFinalInNotTop3++
  if (fin && (fin.home === 'England' || fin.away === 'England')) englandFinalInNotTop3++
}

const pct = (x: number, d = N) => (100 * x / d).toFixed(2)
const topN = (m: Map<string, number>, k = 8) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k)

console.log(`N=${N}  seed=${SEED}`)
console.log(`\nליאור לא בטופ-3: ${notTop3} ריצות = ${pct(notTop3)}%   (לא בטופ-5: ${pct(notTop5)}%)`)
console.log(`(מותנה בכך שהוא לא בטופ-3, כמה עקפו אותו:)`)
for (const [k, v] of [...aboveCount.entries()].sort((a, b) => a[0] - b[0]))
  console.log(`   ${k} עקפו → מקום ${k + 1}: ${pct(v, notTop3)}% מהתרחישים`)

console.log(`\nמי עקף את ליאור (% מבין תרחישי אי-טופ3):`)
for (const [label, v] of topN(beat)) console.log(`   ${label.padEnd(16)} ${pct(v, notTop3)}%`)

console.log(`\nאלופה בתרחישי אי-טופ3:`)
for (const [t, v] of topN(champ)) console.log(`   ${he(t).padEnd(12)} ${pct(v, notTop3)}%`)

console.log(`\nזוכה מקום 3 בתרחישי אי-טופ3:`)
for (const [t, v] of topN(third)) console.log(`   ${he(t).padEnd(12)} ${pct(v, notTop3)}%`)

console.log(`\nמי הגיע לגמר בתרחישי אי-טופ3:`)
for (const [t, v] of topN(finalists)) console.log(`   ${he(t).padEnd(12)} ${pct(v, notTop3)}%`)

console.log(`\nגורל הבחירות של ליאור בתרחישי אי-טופ3:`)
console.log(`   צרפת אלופה (הניחוש שלו):  ${pct(franceChampInNotTop3, notTop3)}%`)
console.log(`   צרפת בגמר:                ${pct(franceFinalInNotTop3, notTop3)}%`)
console.log(`   אנגליה בגמר (ניחושו):     ${pct(englandFinalInNotTop3, notTop3)}%`)
