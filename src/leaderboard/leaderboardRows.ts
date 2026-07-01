import { computeUserPoints, computeGroupBreakdown, computeGroupTeamDetail, isGroupComplete, singleMatchOutcome, singleMatchPoints, koAdvancementFor, POINTS_PER_GOAL, OLEH_POINTS, PLACE_POINT } from './points'
import type { GroupTeamHit } from './points'
import { ALL_GROUP_LETTERS, TEAMS } from '../shared/groups'
import type { GroupLetter } from '../shared/groups'
import { isUnpredicted } from '../shared/types'
import type { GroupMatch, KnockoutMatch, MatchScores, ThirdPlaceQualification, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { matchSortKey, latestBySortKey } from '../shared/matchOrder'
import { isPairing, orientPrediction } from '../formView/knockout/koRounds'
import { competitionRanks } from './rank'
import { knockoutParticipantScore } from '../pages/match/koParticipants'
import type { User } from '../users'

export type Scope = 'all' | GroupLetter | 'range' | 'prob' | 'summary' | 'oleh' | 'crossings' | 'timelapse' | 'records'

// One bettor's group-stage עולות/מיקומים story, team by team, for the dedicated
// breakdown tab: which qualifiers they tipped right (4 pts each) and which exact
// table positions they nailed (1 pt each). Points are derived from the hit lists
// so a per-group filter just re-tallies the filtered hits.
export interface GroupDetailRow {
  label: string
  advancement: GroupTeamHit[]
  places: GroupTeamHit[]
}

export const OLEH_PTS = OLEH_POINTS.group
export const PLACE_PTS = PLACE_POINT

export function olehDetailPoints(advancement: GroupTeamHit[], places: GroupTeamHit[]): number {
  return advancement.length * OLEH_PTS + places.length * PLACE_PTS
}

// Per-bettor group-stage team detail for the "עולות ומיקומים" tab. The view
// filters these hit lists by group and re-tallies, so this stays scope-agnostic.
export function buildGroupDetailRows(users: User[], results: TournamentResults): GroupDetailRow[] {
  return users.map(user => {
    const { advancement, places } = computeGroupTeamDetail(user, results)
    return { label: user.label, advancement, places }
  })
}

function scopeThirdPlace(q: ThirdPlaceQualification, scope: GroupLetter): ThirdPlaceQualification {
  const inScope = (teams: ThirdPlaceStanding[]) => teams.filter(t => t.group === scope)
  return q.resolved
    ? { resolved: true, all: inScope(q.all), qualifiers: inScope(q.qualifiers) }
    : { resolved: false, all: inScope(q.all), tied: inScope(q.tied) }
}

export function buildLeaderboardRows(users: User[], results: TournamentResults) {
  return users
    .map(user => ({
      label: user.label,
      topGoalscorer: user.topGoalscorer,
      predictedChampion: user.predictedChampion,
      groupTeamDetail: computeGroupTeamDetail(user, results),
      ...computeUserPoints(user, results),
    }))
    .sort((a, b) => b.total - a.total)
}

export interface GroupScopeRow {
  label: string
  tzelifaCount: number
  pgiyaCount: number
  matchPoints: number
  advancementPoints: number
  placePoints: number
  goalsPoints: number
  total: number
  // Full-tournament total, independent of any scope/range — context for where a
  // bettor stands overall while reading the in-range form numbers.
  tournamentTotal: number
  // How many actual R32 matches the bettor "participates" in (predicted both
  // teams). Only populated for the all-groups summary; 0 elsewhere.
  r32Count?: number
}

export type GroupSortBy = 'pgiya' | 'tzelifa' | 'combined' | 'matchPoints' | 'advancementPoints' | 'placePoints' | 'goalsPoints' | 'total' | 'tournamentTotal' | 'r32Count'

const combinedHits = (r: GroupScopeRow) => r.tzelifaCount + r.pgiyaCount

export const GROUP_SORTERS: Record<GroupSortBy, (a: GroupScopeRow, b: GroupScopeRow) => number> = {
  pgiya: (a, b) => b.pgiyaCount - a.pgiyaCount || b.tzelifaCount - a.tzelifaCount || b.total - a.total,
  tzelifa: (a, b) => b.tzelifaCount - a.tzelifaCount || b.pgiyaCount - a.pgiyaCount || b.total - a.total,
  combined: (a, b) => combinedHits(b) - combinedHits(a) || b.tzelifaCount - a.tzelifaCount || b.total - a.total,
  matchPoints: (a, b) => b.matchPoints - a.matchPoints || combinedHits(b) - combinedHits(a),
  advancementPoints: (a, b) => b.advancementPoints - a.advancementPoints || b.total - a.total,
  placePoints: (a, b) => b.placePoints - a.placePoints || b.total - a.total,
  goalsPoints: (a, b) => b.goalsPoints - a.goalsPoints || b.total - a.total,
  total: (a, b) => b.total - a.total || combinedHits(b) - combinedHits(a),
  tournamentTotal: (a, b) => b.tournamentTotal - a.tournamentTotal || b.total - a.total || combinedHits(b) - combinedHits(a),
  r32Count: (a, b) => (b.r32Count ?? 0) - (a.r32Count ?? 0) || b.total - a.total,
}

export function playedGroupMatchesChrono(results: TournamentResults): GroupMatch[] {
  return Object.values(results.groupMatches).flat()
    .filter(m => m.scores && !isUnpredicted(m.scores))
    .sort((a, b) => matchSortKey(a.matchDate, a.kickoffIST) - matchSortKey(b.matchDate, b.kickoffIST))
}

// A played match as a "טווח" range-selector label: "בית 2–1 חוץ" in Hebrew.
// Expects a match that already has scores (e.g. from playedGroupMatchesChrono).
export const playedMatchLabel = (m: GroupMatch): string =>
  `${TEAMS[m.homeTeam].he} ${m.scores!.home}–${m.scores!.away} ${TEAMS[m.awayTeam].he}`

// One entry in the chronological timeline the "טווח" range spans. Group and
// knockout matches share one list so the range can stretch across the whole
// tournament, not just the group stage. A KO match carries the same scoreline
// shape as a group one, but is scored by a different rule (oriented pairing).
export type PlayedMatch =
  | { kind: 'group'; match: GroupMatch }
  | { kind: 'ko'; match: KnockoutMatch }

// Flat accessors over the canonical tagged union, so callers that only need the
// scalar fields (id, scores, the two team codes, the date) don't reach into the
// underlying match and don't need their own shape. The one irreducible split: a
// group match is keyed by its string id (e.g. 'A1'); a KO match by its matchNum.
export const playedMatchId = (p: PlayedMatch): string =>
  p.kind === 'group' ? p.match.id : String(p.match.matchNum)
export const playedMatchScores = (p: PlayedMatch): MatchScores => p.match.scores!
export const playedMatchHome = (p: PlayedMatch): string =>
  p.kind === 'group' ? p.match.homeTeam : p.match.home
export const playedMatchAway = (p: PlayedMatch): string =>
  p.kind === 'group' ? p.match.awayTeam : p.match.away
export const playedMatchDate = (p: PlayedMatch): string => p.match.matchDate ?? ''

const playedSortKey = (p: PlayedMatch) => matchSortKey(p.match.matchDate, p.match.kickoffIST)

// Every played match — group AND knockout — in true chronological order, the
// timeline the range selector and range-scoped leaderboard both index into.
export function playedMatchesChrono(results: TournamentResults): PlayedMatch[] {
  const group: PlayedMatch[] = Object.values(results.groupMatches).flat()
    .filter(m => m.scores && !isUnpredicted(m.scores))
    .map(match => ({ kind: 'group', match }))
  const ks = results.knockoutStages
  const ko: PlayedMatch[] = ks
    ? [...ks.r32, ...ks.r16, ...ks.qf, ...ks.sf, ...ks.thirdPlace, ...ks.final]
        .filter(m => m.scores && !isUnpredicted(m.scores))
        .map(match => ({ kind: 'ko', match }))
    : []
  return [...group, ...ko].sort((a, b) => playedSortKey(a) - playedSortKey(b))
}

// The user's prediction for an actual played match, dispatching the one
// irreducible difference: group by id, knockout by oriented pairing.
export function predictionFor(user: User, played: PlayedMatch): MatchScores | null {
  return played.kind === 'group'
    ? (user.predictions[played.match.id] ?? null)
    : knockoutParticipantScore(played.match, user)
}

// Range-selector label for a unified timeline entry. KO team names are stored as
// TEAMS keys too, so both kinds resolve to the same Hebrew "בית 2–1 חוץ" shape.
export const playedMatchChronoLabel = (p: PlayedMatch): string =>
  p.kind === 'group'
    ? playedMatchLabel(p.match)
    : `${TEAMS[p.match.home]?.he ?? p.match.home} ${p.match.scores!.home}–${p.match.scores!.away} ${TEAMS[p.match.away]?.he ?? p.match.away}`

// The bettor's own knockout round a result fixture must be matched within, keyed
// by match number (r32 73–88, r16 89–96, qf 97–100, sf 101–102, third 103, final
// 104). Match points are round-scoped: a bettor only scores a fixture if they
// predicted those two teams to meet in *that same round*, exactly as koMatchPoints
// (and thus computeUserPoints) does — the same pairing tipped for a later round
// doesn't count against an earlier-round result.
function koRoundKey(matchNum: number): keyof User['knockoutStages'] {
  return matchNum <= 88 ? 'r32'
    : matchNum <= 96 ? 'r16'
    : matchNum <= 100 ? 'qf'
    : matchNum <= 102 ? 'sf'
    : matchNum === 103 ? 'thirdPlace'
    : 'final'
}

// A bettor's צליפה/פגיעה tally and match points across a set of played knockout
// matches. Mirrors the group-match loop in rowsForPlayedMatches but routes through
// the pairing matcher: a KO fixture is credited when the bettor predicted its two
// teams to meet in that same round (either order), oriented to the real home/away.
function koHits(user: User, koMatches: KnockoutMatch[]): { tzelifa: number; pgiya: number; points: number } {
  if (koMatches.length === 0) return { tzelifa: 0, pgiya: 0, points: 0 }
  const uko = user.knockoutStages
  let tzelifa = 0, pgiya = 0, points = 0
  for (const rm of koMatches) {
    if (!rm.scores || isUnpredicted(rm.scores) || !rm.home || !rm.away) continue
    const um = (uko[koRoundKey(rm.matchNum)] ?? []).find(m => isPairing(m, rm.home, rm.away))
    if (!um || !um.scores || isUnpredicted(um.scores)) continue
    const predicted = orientPrediction(um, rm)!
    const outcome = singleMatchOutcome(predicted, rm.scores)
    if (outcome === 'tzelifa') tzelifa++
    else if (outcome === 'pgiya') pgiya++
    points += singleMatchPoints(String(rm.matchNum), predicted, rm.scores)
  }
  return { tzelifa, pgiya, points }
}

// The bettor's KO advancement/title points that fall inside this stretch. Each KO
// fixture independently confirms one advancer, so its advancement points are owned
// by that very match (not lumped onto the round's last-played match) — the same
// per-fixture attribution the per-match KO leaderboard uses. This keeps an earlier
// match's confirmed advancer credited to it even after later matches are played.
function koAdvancementForSlice(user: User, koMatches: KnockoutMatch[]): number {
  return koMatches.reduce((sum, m) => sum + koAdvancementFor(user, m), 0)
}

// The match that decides a group: its chronologically-last played match, but
// only once the group's table is complete. Advancement/place points are awarded
// at this moment, so a range "owns" them iff it contains this match. Null while
// the group is still in progress.
function groupCompletingMatch(results: TournamentResults, group: GroupLetter | string): GroupMatch | null {
  const table = results.groupTables?.[group]
  if (!table || !isGroupComplete(table)) return null
  const played = (results.groupMatches?.[group] ?? []).filter(m => m.scores && !isUnpredicted(m.scores))
  return latestBySortKey(played)
}

// Results scoped to the group-completion events that fall inside `matches`, so
// computeGroupBreakdown attributes advancement/place to exactly one range each:
// a group's points land in the range with its completing match, and third-place
// qualifier points in the range where the last group completes (when it resolves).
// Returns null when no completion lands in the slice — the common case for a
// partial range or an early cumulative snapshot — so callers skip the breakdown.
function completionScopedResults(results: TournamentResults, sliceIds: Set<string>): TournamentResults | null {
  const completing: Record<string, GroupMatch> = {}
  for (const group of Object.keys(results.groupTables ?? {})) {
    const m = groupCompletingMatch(results, group)
    if (m) completing[group] = m
  }
  const groupsInSlice = Object.keys(completing).filter(g => sliceIds.has(completing[g].id))
  const resolveMatch = latestBySortKey(Object.values(completing))
  const thirdInSlice = !!results.thirdPlaceQualification?.resolved && !!resolveMatch && sliceIds.has(resolveMatch.id)
  if (groupsInSlice.length === 0 && !thirdInSlice) return null
  return {
    ...results,
    groupMatches: Object.fromEntries(groupsInSlice.map(g => [g, results.groupMatches[g] ?? []])),
    groupTables: Object.fromEntries(groupsInSlice.map(g => [g, results.groupTables[g] ?? []])),
    thirdPlaceQualification: thirdInSlice ? results.thirdPlaceQualification : { resolved: false, all: [], tied: [] },
  }
}

// `withTournamentTotal` defaults on for display tables; ranking-only callers
// (ranksAsOf) pass false to skip the full-tournament computeUserPoints, which
// they never read — that recompute dominates the trajectory cost otherwise.
export function rowsForMatches(users: User[], results: TournamentResults, matches: GroupMatch[], withTournamentTotal = true): GroupScopeRow[] {
  return rowsForPlayedMatches(users, results, matches.map(match => ({ kind: 'group', match })), withTournamentTotal)
}

// The unified per-stretch scorer: group matches score by id as before, knockout
// matches by oriented pairing (koHits). Group advancement/place points still ride
// in via completionScopedResults, gated on the group-completing match being in
// the slice — KO advancement is layered on separately (see buildRangeRows).
export function rowsForPlayedMatches(users: User[], results: TournamentResults, played: PlayedMatch[], withTournamentTotal = true): GroupScopeRow[] {
  const groupMatches = played.flatMap(p => p.kind === 'group' ? [p.match] : [])
  const koMatches = played.flatMap(p => p.kind === 'ko' ? [p.match] : [])
  const scoped = completionScopedResults(results, new Set(groupMatches.map(m => m.id)))
  return users.map(user => {
    const predictionById: Record<string, MatchScores> = {}
    for (const m of Object.values(user.groupMatches).flat()) {
      if (m.scores) predictionById[m.id] = m.scores
    }
    let tzelifaCount = 0
    let pgiyaCount = 0
    let matchPoints = 0
    for (const match of groupMatches) {
      const predicted = predictionById[match.id] ?? { home: null, away: null }
      const outcome = singleMatchOutcome(predicted, match.scores!)
      if (outcome === 'tzelifa') tzelifaCount++
      else if (outcome === 'pgiya') pgiyaCount++
      matchPoints += singleMatchPoints(match.id, predicted, match.scores!)
    }
    const ko = koHits(user, koMatches)
    tzelifaCount += ko.tzelifa
    pgiyaCount += ko.pgiya
    matchPoints += ko.points
    // A picked scorer's goals count wherever they're netted — group matches keyed
    // by id, knockout matches by matchNum — so the slice matches the tournament total.
    const goalsByMatch = results.playerMatchGoals?.[user.topGoalscorer]
    const groupGoals = groupMatches.reduce((sum, m) => sum + (goalsByMatch?.[m.id] ?? 0), 0)
    const koGoals = koMatches.reduce((sum, m) => sum + (goalsByMatch?.[String(m.matchNum)] ?? 0), 0)
    const goalsPoints = (groupGoals + koGoals) * POINTS_PER_GOAL
    // computeUserPoints drives the full-tournament total shown alongside the slice;
    // only compute it when that column is actually displayed.
    const breakdown = withTournamentTotal ? computeUserPoints(user, results) : null
    const group = scoped ? computeGroupBreakdown(user, scoped) : { advancementPoints: 0, placePoints: 0 }
    const koAdvancement = koAdvancementForSlice(user, koMatches)
    const advancementPoints = group.advancementPoints + koAdvancement
    const placePoints = group.placePoints
    const total = matchPoints + advancementPoints + placePoints + goalsPoints
    return { label: user.label, tzelifaCount, pgiyaCount, matchPoints, advancementPoints, placePoints, goalsPoints, total, tournamentTotal: withTournamentTotal ? breakdown!.total : 0 }
  })
}

// Points gained over a chosen stretch — played matches (group and knockout) from
// `fromIndex` through `toIndex` (1-based, inclusive) in chronological order. A
// form table: sort by total to see who gained the most across the stretch.
export function buildRangeRows(users: User[], results: TournamentResults, fromIndex: number, toIndex: number): GroupScopeRow[] {
  return rowsForPlayedMatches(users, results, playedMatchesChrono(results).slice(fromIndex - 1, toIndex))
}

// Each bettor's cumulative rank as of the first `count` played matches.
function ranksAsOf(users: User[], results: TournamentResults, chrono: PlayedMatch[], count: number): Record<string, number> {
  const rows = rowsForPlayedMatches(users, results, chrono.slice(0, count), false).sort(GROUP_SORTERS.total)
  const ranks = competitionRanks(rows, r => r.total)
  return Object.fromEntries(rows.map((r, i) => [r.label, ranks[i]]))
}

// How many places each bettor moved in the cumulative standings across the
// stretch: their rank just before it (as of match fromIndex-1) vs at its end
// (as of match toIndex). Positive = climbed, negative = dropped, 0 = held.
// Null when the stretch starts at game 1 — there's no "before" to compare to.
export function rangePlaceMovement(users: User[], results: TournamentResults, fromIndex: number, toIndex: number): Record<string, number | null> {
  if (fromIndex <= 1) return Object.fromEntries(users.map(u => [u.label, null]))
  const chrono = playedMatchesChrono(results)
  const before = ranksAsOf(users, results, chrono, fromIndex - 1)
  const after = ranksAsOf(users, results, chrono, toIndex)
  return Object.fromEntries(users.map(u => [u.label, before[u.label] - after[u.label]]))
}

// Each bettor's rank after every played match, chronologically:
// trajectory[label][i] = their cumulative rank as of played match i+1. Spans the
// whole tournament — group stage then knockouts — via the unified timeline.
export function rankTrajectories(users: User[], results: TournamentResults): Record<string, number[]> {
  const chrono = playedMatchesChrono(results)
  const snapshots = Array.from({ length: chrono.length }, (_, i) => ranksAsOf(users, results, chrono, i + 1))
  return Object.fromEntries(users.map(u => [u.label, snapshots.map(s => s[u.label])]))
}

// Each bettor's hit tally across all played matches — pgiya (correct direction)
// and tzelifa (exact score) — matching the trajectory's scope (group AND
// knockout), so the chart caption can summarise accuracy alongside the rank line.
export function hitStats(users: User[], results: TournamentResults): Record<string, { pgiya: number; tzelifa: number }> {
  const rows = rowsForPlayedMatches(users, results, playedMatchesChrono(results), false)
  return Object.fromEntries(rows.map(r => [r.label, { pgiya: r.pgiyaCount, tzelifa: r.tzelifaCount }]))
}

// How many actual R32 matches a bettor "participates" in — they predicted both
// teams that actually reached that matchup (regardless of side or which slot their
// bracket routed it through). Fills in as the bracket firms up; unresolved slots
// don't count.
export function countR32Participation(userR32: KnockoutMatch[], actualR32: KnockoutMatch[]): number {
  return actualR32.reduce((n, actual) => {
    if (!actual.resolved) return n
    const um = userR32.find(m => m.resolved && isPairing(m, actual.home, actual.away))
    return n + (um ? 1 : 0)
  }, 0)
}

// Group-stage summary: every group's hits and points folded into one row per
// bettor, so the board can show a single "all groups" table with the same
// columns as the per-group (לפי בית) view, plus the R32-participation count.
// tournamentTotal is full-tournament already, so it's taken as-is not summed.
export function buildGroupSummaryRows(users: User[], results: TournamentResults): GroupScopeRow[] {
  const byLabel = new Map<string, GroupScopeRow>()
  for (const letter of ALL_GROUP_LETTERS) {
    for (const row of buildGroupScopeRows(users, results, letter)) {
      const acc = byLabel.get(row.label)
      if (!acc) {
        byLabel.set(row.label, { ...row })
        continue
      }
      acc.tzelifaCount += row.tzelifaCount
      acc.pgiyaCount += row.pgiyaCount
      acc.matchPoints += row.matchPoints
      acc.advancementPoints += row.advancementPoints
      acc.placePoints += row.placePoints
      acc.goalsPoints += row.goalsPoints
      acc.total += row.total
    }
  }
  const actualR32 = results.knockoutStages?.r32 ?? []
  return users
    .map(u => {
      const row = byLabel.get(u.label)
      if (!row) return undefined
      row.r32Count = countR32Participation(u.knockoutStages?.r32 ?? [], actualR32)
      return row
    })
    .filter((r): r is GroupScopeRow => !!r)
}

type MatchResult = TournamentResults['groupMatches'][string][number]

export function buildGroupScopeRows(users: User[], results: TournamentResults, group: GroupLetter): GroupScopeRow[] {
  const filtered: TournamentResults = {
    ...results,
    groupMatches: { [group]: results.groupMatches[group] ?? [] },
    groupTables: { [group]: results.groupTables[group] ?? [] },
    thirdPlaceQualification: scopeThirdPlace(results.thirdPlaceQualification, group),
  }

  const resultById: Record<string, MatchResult> = {}
  for (const m of results.groupMatches[group] ?? []) resultById[m.id] = m

  return users.map(user => {
    let tzelifaCount = 0
    let pgiyaCount = 0
    for (const userMatch of user.groupMatches[group] ?? []) {
      const outcome = singleMatchOutcome(
        userMatch.scores ?? { home: null, away: null },
        resultById[userMatch.id]?.scores ?? { home: null, away: null },
      )
      if (outcome === 'tzelifa') tzelifaCount++
      else if (outcome === 'pgiya') pgiyaCount++
    }
    const { matchPoints, advancementPoints, placePoints, total } = computeGroupBreakdown(user, filtered)
    return { label: user.label, tzelifaCount, pgiyaCount, matchPoints, advancementPoints, placePoints, goalsPoints: 0, total, tournamentTotal: computeUserPoints(user, results).total }
  })
}
