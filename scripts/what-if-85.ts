// One-off analysis: "how would the table look if every match ended at the 85th
// minute?" — i.e. if no goal scored in the 86th minute or later (incl. stoppage
// time, extra time, shootouts) had counted.
//
// Scope: we hold the whole tournament STRUCTURE at reality (who qualified, the
// bracket, who advanced in each KO tie, champion, golden boot) and change ONLY
// the match SCORELINES to their 85' value, then recompute each bettor's
// scoreline points (פגיעה/צליפה) — group + knockout. That isolates exactly the
// "late goals robbed my score bet" effect without re-simulating a whole
// alternate knockout bracket (which would be pure speculation).
//
// Goal timelines come from ESPN's scoreboard `details`; any match that doesn't
// reconstruct exactly to its real full-time score is retried against the complete
// per-event summary `keyEvents`, and only altered when it then matches. Anything
// still unreconstructable is left at its real score (0 delta) and reported.
//
// Throwaway analysis script — not wired into the app or the cron.

import { USERS } from '../src/users/index.ts'
import { tournamentResults } from '../src/tournament-results.ts'
import {
  buildLeaderboardRows,
  rowsForPlayedMatches,
  playedMatchesChrono,
} from '../src/leaderboard/leaderboardRows.ts'
import { GROUPS, TEAMS } from '../src/shared/groups.ts'
import { espnIdToMatchNum } from '../src/shared/koEventIds.ts'
import { isKoReversed } from '../src/shared/koOrient.ts'
import type { TournamentResults, MatchScores } from '../src/shared/types.ts'

const TOURNAMENT_DATES = '20260611-20260719'
const SB_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${TOURNAMENT_DATES}&limit=300`
const summaryUrl = (id: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`
const CUTOFF = 85

const NAME_ALIASES: Record<string, string> = {
  'Korea Republic': 'South Korea', Czechia: 'Czech Republic', Türkiye: 'Turkey',
  USA: 'United States', 'IR Iran': 'Iran', "Côte d'Ivoire": 'Ivory Coast',
  'Cape Verde Islands': 'Cape Verde', 'Congo DR': 'DR Congo',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
}
const canonical = (n: string | null | undefined): string | null =>
  n == null ? null : NAME_ALIASES[n] ?? n

const pairIndex = new Map<string, { id: string; reversed: boolean }>()
for (const group of Object.values(GROUPS)) {
  for (const m of group.matches) {
    pairIndex.set(`${m.homeTeam}|${m.awayTeam}`, { id: m.id, reversed: false })
    pairIndex.set(`${m.awayTeam}|${m.homeTeam}`, { id: m.id, reversed: true })
  }
}

interface Play {
  clock?: { displayValue?: string; value?: number }
  scoringPlay?: boolean
  shootout?: boolean
  team?: { id?: string }
}
interface Event {
  id?: string
  status?: { type?: { completed?: boolean } }
  competitions?: {
    competitors?: { homeAway?: string; team?: { id?: string; displayName?: string } }[]
    details?: Play[]
  }[]
}

interface Goal { side: 'home' | 'away'; minute: number }

// A completed ESPN fixture mapped to OUR match, with the goal-play list from the
// scoreboard and enough context to reconstruct + (if needed) refetch its summary.
interface Target {
  key: string          // our group id ('A1') or KO matchNum ('73')
  reversed: boolean    // ESPN lists home/away reversed vs our orientation
  espnId: string
  homeId?: string
  awayId?: string
  details: Play[]
}

const baseMinute = (p: Play): number => {
  const n = parseInt(p.clock?.displayValue ?? '', 10)
  if (!Number.isNaN(n)) return n
  return p.clock?.value != null ? Math.floor(p.clock.value / 60) + 1 : 999
}

// ESPN credits the scoring side on `team` for BOTH normal and own goals (an own
// goal is listed under the beneficiary), so a scoring play always belongs to its
// team.id side — no own-goal flip.
function goalsFromPlays(plays: Play[], homeId?: string, awayId?: string): Goal[] {
  const goals: Goal[] = []
  for (const p of plays) {
    if (!p.scoringPlay || p.shootout) continue
    const id = p.team?.id
    const side = id === homeId ? 'home' : id === awayId ? 'away' : null
    if (!side) continue
    goals.push({ side, minute: baseMinute(p) })
  }
  return goals
}

function scoreAt(goals: Goal[], reversed: boolean, cutoff: number): { home: number; away: number } {
  let home = 0, away = 0
  for (const g of goals) {
    if (g.minute > cutoff) continue
    if (g.side === 'home') home++
    else away++
  }
  return reversed ? { home: away, away: home } : { home, away }
}

const heTeam = (t: string) => TEAMS[t]?.he ?? t
const eq = (a: { home: number; away: number }, b: MatchScores) => a.home === b.home && a.away === b.away

function realGroupScore(id: string): MatchScores | null {
  for (const matches of Object.values(tournamentResults.groupMatches)) {
    const m = matches.find(x => x.id === id)
    if (m?.scores && m.scores.home != null && m.scores.away != null) return m.scores
  }
  return null
}
function realKoScore(num: string): MatchScores | null {
  const ks = tournamentResults.knockoutStages
  for (const round of [ks.r32, ks.r16, ks.qf, ks.sf, ks.thirdPlace, ks.final]) {
    const m = round.find(x => String(x.matchNum) === num)
    if (m?.scores && m.scores.home != null && m.scores.away != null) return m.scores
  }
  return null
}

// Simple concurrency-limited map, so ~dozen summary fetches don't go one-by-one.
async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

async function main() {
  const { events } = (await (await fetch(SB_URL)).json()) as { events?: Event[] }
  const targets = new Map<string, Target>()
  for (const e of events ?? []) {
    if (!e.status?.type?.completed || !e.id) continue
    const comp = e.competitions?.[0]
    const cs = comp?.competitors ?? []
    const h = cs.find(c => c.homeAway === 'home')
    const a = cs.find(c => c.homeAway === 'away')
    if (!h || !a) continue
    const cHome = canonical(h.team?.displayName)
    const cAway = canonical(a.team?.displayName)
    const groupHit = cHome && cAway ? pairIndex.get(`${cHome}|${cAway}`) : undefined
    let key: string | undefined
    let reversed = false
    if (groupHit) { key = groupHit.id; reversed = groupHit.reversed }
    else {
      const num = espnIdToMatchNum(e.id)
      if (num !== undefined) { key = String(num); reversed = isKoReversed(num, h.team?.displayName ?? null, a.team?.displayName ?? null) }
    }
    if (!key) continue
    targets.set(key, { key, reversed, espnId: e.id, homeId: h.team?.id, awayId: a.team?.id, details: comp?.details ?? [] })
  }

  // Collect every played match we need a timeline for, with its real (validation) score.
  interface Need { key: string; kind: 'group' | 'ko'; home: string; away: string; real: MatchScores; regCutoff: number }
  const needs: Need[] = []
  for (const matches of Object.values(tournamentResults.groupMatches)) {
    for (const m of matches) {
      const real = realGroupScore(m.id)
      if (real) needs.push({ key: m.id, kind: 'group', home: m.homeTeam, away: m.awayTeam, real, regCutoff: 999 })
    }
  }
  const ks = tournamentResults.knockoutStages
  for (const round of [ks.r32, ks.r16, ks.qf, ks.sf, ks.thirdPlace, ks.final]) {
    for (const m of round) {
      const real = realKoScore(String(m.matchNum))
      if (real) needs.push({ key: String(m.matchNum), kind: 'ko', home: m.home, away: m.away, real, regCutoff: 90 })
    }
  }

  // Pass 1: reconstruct from scoreboard details. Collect failures to refetch.
  const goalsByKey = new Map<string, Goal[]>()
  const reversedByKey = new Map<string, boolean>()
  const failures: Need[] = []
  for (const n of needs) {
    const t = targets.get(n.key)
    if (!t) { failures.push(n); continue }
    reversedByKey.set(n.key, t.reversed)
    const goals = goalsFromPlays(t.details, t.homeId, t.awayId)
    goalsByKey.set(n.key, goals)
    if (!eq(scoreAt(goals, t.reversed, n.regCutoff), n.real)) failures.push(n)
  }

  // Pass 2: for failures with a known ESPN id, refetch the complete summary keyEvents.
  const refetchable = failures.filter(n => targets.get(n.key))
  const summaries = await pool(refetchable, 6, async n => {
    const t = targets.get(n.key)!
    try {
      const sum = (await (await fetch(summaryUrl(t.espnId)).then(r => r)).json()) as { keyEvents?: Play[] }
      return { key: n.key, plays: sum.keyEvents ?? [] }
    } catch (err) {
      return { key: n.key, plays: [] as Play[], err: String(err) }
    }
  })
  for (const s of summaries) {
    const t = targets.get(s.key)!
    const goals = goalsFromPlays(s.plays, t.homeId, t.awayId)
    goalsByKey.set(s.key, goals)
  }

  // Final validation + build the 85' score map (only exactly-reconstructed matches).
  const alt85: Record<string, { home: number; away: number }> = {}
  const changed: { key: string; kind: 'group' | 'ko'; home: string; away: string; full: MatchScores; m85: { home: number; away: number } }[] = []
  const unresolved: string[] = []
  for (const n of needs) {
    const goals = goalsByKey.get(n.key)
    const reversed = reversedByKey.get(n.key) ?? targets.get(n.key)?.reversed ?? false
    if (!goals) { unresolved.push(`${n.kind} ${n.key} (${heTeam(n.home)}-${heTeam(n.away)}): no ESPN event`); continue }
    if (!eq(scoreAt(goals, reversed, n.regCutoff), n.real)) {
      const g = scoreAt(goals, reversed, n.regCutoff)
      unresolved.push(`${n.kind} ${n.key} (${heTeam(n.home)}-${heTeam(n.away)}): recon ${g.home}-${g.away} ≠ real ${n.real.home}-${n.real.away}`)
      continue
    }
    const m85 = scoreAt(goals, reversed, CUTOFF)
    alt85[n.key] = m85
    if (!eq(m85, n.real)) changed.push({ key: n.key, kind: n.kind, home: n.home, away: n.away, full: n.real, m85 })
  }

  // alt results: swap scorelines to 85', keep drawWinner/structure.
  const alt: TournamentResults = structuredClone(tournamentResults)
  for (const matches of Object.values(alt.groupMatches)) {
    for (const m of matches) { const s = alt85[m.id]; if (s) m.scores = { home: s.home, away: s.away } }
  }
  const aks = alt.knockoutStages
  for (const round of [aks.r32, aks.r16, aks.qf, aks.sf, aks.thirdPlace, aks.final]) {
    for (const m of round) {
      const s = alt85[String(m.matchNum)]
      if (s && m.scores) m.scores = { home: s.home, away: s.away, ...(m.scores.drawWinner ? { drawWinner: m.scores.drawWinner } : {}) }
    }
  }

  const realRows = buildLeaderboardRows(USERS, tournamentResults)
  const realTotal = new Map(realRows.map(r => [r.label, r.total]))
  const realMatch = new Map(rowsForPlayedMatches(USERS, tournamentResults, playedMatchesChrono(tournamentResults), false).map(r => [r.label, r.matchPoints]))
  const altMatch = new Map(rowsForPlayedMatches(USERS, alt, playedMatchesChrono(alt), false).map(r => [r.label, r.matchPoints]))

  interface Row { label: string; cur: number; alt: number; delta: number }
  const rows: Row[] = USERS.map(u => {
    const cur = realTotal.get(u.label) ?? 0
    const delta = (altMatch.get(u.label) ?? 0) - (realMatch.get(u.label) ?? 0)
    return { label: u.label, cur, alt: cur + delta, delta }
  })
  const rank = (arr: Row[], key: 'cur' | 'alt') => {
    const s = [...arr].sort((a, b) => b[key] - a[key])
    const r = new Map<string, number>()
    s.forEach((row, i) => r.set(row.label, i + 1))
    return r
  }
  const curRank = rank(rows, 'cur')
  const altRank = rank(rows, 'alt')
  const sorted = [...rows].sort((a, b) => b.cur - a.cur)

  console.log('\n=== VALIDATION ===')
  console.log(`Played matches needing a timeline: ${needs.length}`)
  console.log(`Refetched summaries for ${refetchable.length} that the scoreboard couldn't reconstruct.`)
  if (unresolved.length) {
    console.log(`⚠ ${unresolved.length} still NOT altered (kept at real score):`)
    for (const u of unresolved) console.log('   ' + u)
  } else {
    console.log('All played matches reconstructed exactly. ✓')
  }

  console.log('\n=== MATCHES WITH A DIFFERENT SCORE AT 85\' ===')
  console.log(`${changed.length} of ${needs.length - unresolved.length} matches:`)
  for (const c of changed) {
    const tag = c.kind === 'ko' ? '[KO] ' : ''
    console.log(`   ${tag}${heTeam(c.home)} ${c.m85.home}-${c.m85.away} ${heTeam(c.away)}   (85')  →  FT ${c.full.home}-${c.full.away}`)
  }

  console.log('\n=== TABLE: current vs "ended at 85\'" ===')
  for (const row of sorted) {
    const cr = curRank.get(row.label)!, ar = altRank.get(row.label)!
    const move = cr === ar ? '   ' : cr > ar ? `↑${cr - ar}` : `↓${ar - cr}`
    const d = row.delta === 0 ? '0' : row.delta > 0 ? `+${row.delta}` : `${row.delta}`
    console.log(`  ${String(cr).padStart(2)}→${String(ar).padStart(2)} ${move.padStart(3)}  ${row.label.padEnd(26)} ${String(row.cur).padStart(4)} → ${String(row.alt).padStart(4)}  (${d})`)
  }

  console.log('\n=== JSON ===')
  console.log(JSON.stringify({
    unresolved,
    changed: changed.map(c => ({ ...c, homeHe: heTeam(c.home), awayHe: heTeam(c.away) })),
    rows: sorted.map(r => ({ ...r, curRank: curRank.get(r.label), altRank: altRank.get(r.label) })),
  }))
}

main().catch(e => { console.error(e); process.exit(1) })
