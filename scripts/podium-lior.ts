// Throwaway analysis for the R16 (שמינית) preview summary.
// Prints: current leaderboard, the real R16 pairings, who "participates" in each
// (predicted both teams to meet in that round), per-bettor R16 participation
// counts, and each contender's deep (QF+) picks with alive/out status.

import { USERS } from '../src/users/index.ts'
import { tournamentResults } from '../src/tournament-results.ts'
import { buildLeaderboardRows } from '../src/leaderboard/leaderboardRows.ts'
import { advancingTeam } from '../src/leaderboard/points.ts'
import { isPairing } from '../src/formView/knockout/koRounds.ts'
import { TEAMS } from '../src/shared/groups.ts'
import type { User } from '../src/users/index.ts'

const he = (t: string | undefined) => (t ? (TEAMS[t]?.he ?? t) : '—')

const ks = tournamentResults.knockoutStages
const r32 = ks.r32
const r16 = ks.r16

// eliminated / alive from full R32
const eliminated = new Set<string>()
const alive = new Set<string>()
for (const m of r32) {
  const w = advancingTeam(m)
  if (!w || !m.home || !m.away) continue
  alive.add(w)
  eliminated.add(w === m.home ? m.away : m.home)
}
const isAlive = (t: string | undefined) => (t ? alive.has(t) : false)
const isOut = (t: string | undefined) => (t ? eliminated.has(t) : false)
const flag = (t: string | undefined) => isOut(t) ? `${he(t)}✗` : isAlive(t) ? `${he(t)}✓` : `${he(t)}?`

const rows = buildLeaderboardRows(USERS, tournamentResults)
const userByLabel = new Map(USERS.map(u => [u.label, u]))

console.log('\n=== CURRENT LEADERBOARD (R32 complete) ===')
rows.forEach((r, i) => {
  const prev = i > 0 ? rows[i - 1].total - r.total : 0
  console.log(`${String(i + 1).padStart(2)}. ${r.label.padEnd(22)} ${String(r.total).padStart(4)}  (${prev ? '-' + prev : '  '})`)
})

console.log('\n=== REAL R16 PAIRINGS (89-96) ===')
for (const m of r16) console.log(`  #${m.matchNum}: ${he(m.home)} – ${he(m.away)}`)

// Who participates in each R16 match: predicted these two to meet in R16.
console.log('\n=== R16 PARTICIPATION (predicted this exact R16 pairing) ===')
const partCount = new Map<string, number>()
for (const rm of r16) {
  if (!rm.home || !rm.away) continue
  const who: string[] = []
  for (const u of USERS) {
    const um = u.knockoutStages.r16.find(m => isPairing(m, rm.home, rm.away))
    if (um && um.scores && um.scores.home != null) who.push(u.label)
  }
  who.forEach(l => partCount.set(l, (partCount.get(l) ?? 0) + 1))
  console.log(`  ${he(rm.home)}–${he(rm.away)} (${who.length}): ${who.join(', ')}`)
}

console.log('\n=== R16 PARTICIPATION COUNT per bettor (sorted) ===')
;[...partCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([l, n]) => {
  const rank = rows.findIndex(r => r.label === l) + 1
  console.log(`  ${String(n)}  ${l} (מקום ${rank})`)
})
console.log('  0 participations:', USERS.filter(u => !partCount.has(u.label)).map(u => u.label).join(', ') || '—')

console.log('\n=== DEEP PICKS (✓alive ✗out) — sorted by total ===')
function deepLine(u: User): string {
  return [
    `אלופה: ${flag(u.predictedChampion)}`,
    `גמר: ${(u.predictedFinalTeams ?? []).map(flag).join(',')}`,
    `חצי: ${(u.predictedSFTeams ?? []).map(flag).join(',')}`,
    `שלישית: ${flag(u.predictedThirdPlaceWinner)}`,
    `תותח: ${u.topGoalscorer}`,
  ].join('  |  ')
}
for (const r of rows.slice(0, 12)) {
  console.log(`\n${r.label} (${r.total})`)
  console.log('  ' + deepLine(userByLabel.get(r.label)!))
}

console.log('\n=== ALIVE TEAMS ===', [...alive].map(he).join(', '))
console.log('=== ELIMINATED IN R32 ===', [...eliminated].map(he).join(', '))
