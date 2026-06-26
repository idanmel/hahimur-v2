import { computeUserPoints, computeGroupBreakdown, computeGroupTeamDetail, isGroupComplete, singleMatchOutcome, singleMatchPoints, POINTS_PER_GOAL, OLEH_POINTS, PLACE_POINT } from './points'
import type { GroupTeamHit } from './points'
import { ALL_GROUP_LETTERS } from '../shared/groups'
import type { GroupLetter } from '../shared/groups'
import { isUnpredicted } from '../shared/types'
import type { GroupMatch, KnockoutMatch, MatchScores, ThirdPlaceQualification, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { matchSortKey, latestBySortKey } from '../shared/matchOrder'
import { isPlayerParticipatingInKOMatch } from '../formView/knockout/knockout'
import { competitionRanks } from './rank'
import type { User } from '../users'

export type Scope = 'all' | GroupLetter | 'range' | 'prob' | 'summary' | 'oleh' | 'crossings' | 'timelapse'

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
  const scoped = completionScopedResults(results, new Set(matches.map(m => m.id)))
  return users.map(user => {
    const predictionById: Record<string, MatchScores> = {}
    for (const m of Object.values(user.groupMatches).flat()) {
      if (m.scores) predictionById[m.id] = m.scores
    }
    let tzelifaCount = 0
    let pgiyaCount = 0
    let matchPoints = 0
    for (const match of matches) {
      const predicted = predictionById[match.id] ?? { home: null, away: null }
      const outcome = singleMatchOutcome(predicted, match.scores!)
      if (outcome === 'tzelifa') tzelifaCount++
      else if (outcome === 'pgiya') pgiyaCount++
      matchPoints += singleMatchPoints(match.id, predicted, match.scores!)
    }
    const goalsByMatch = results.playerMatchGoals?.[user.topGoalscorer]
    const goalsPoints = matches.reduce((sum, m) => sum + (goalsByMatch?.[m.id] ?? 0), 0) * POINTS_PER_GOAL
    const { advancementPoints, placePoints } = scoped
      ? computeGroupBreakdown(user, scoped)
      : { advancementPoints: 0, placePoints: 0 }
    const total = matchPoints + advancementPoints + placePoints + goalsPoints
    return { label: user.label, tzelifaCount, pgiyaCount, matchPoints, advancementPoints, placePoints, goalsPoints, total, tournamentTotal: withTournamentTotal ? computeUserPoints(user, results).total : 0 }
  })
}

// Points gained over a chosen stretch — played group matches from `fromIndex`
// through `toIndex` (1-based, inclusive) in chronological order. A form table:
// sort by total to see who gained the most across the stretch.
export function buildRangeRows(users: User[], results: TournamentResults, fromIndex: number, toIndex: number): GroupScopeRow[] {
  return rowsForMatches(users, results, playedGroupMatchesChrono(results).slice(fromIndex - 1, toIndex))
}

// Each bettor's cumulative rank as of the first `count` played matches.
function ranksAsOf(users: User[], results: TournamentResults, chrono: GroupMatch[], count: number): Record<string, number> {
  const rows = rowsForMatches(users, results, chrono.slice(0, count), false).sort(GROUP_SORTERS.total)
  const ranks = competitionRanks(rows, r => r.total)
  return Object.fromEntries(rows.map((r, i) => [r.label, ranks[i]]))
}

// How many places each bettor moved in the cumulative standings across the
// stretch: their rank just before it (as of match fromIndex-1) vs at its end
// (as of match toIndex). Positive = climbed, negative = dropped, 0 = held.
// Null when the stretch starts at game 1 — there's no "before" to compare to.
export function rangePlaceMovement(users: User[], results: TournamentResults, fromIndex: number, toIndex: number): Record<string, number | null> {
  if (fromIndex <= 1) return Object.fromEntries(users.map(u => [u.label, null]))
  const chrono = playedGroupMatchesChrono(results)
  const before = ranksAsOf(users, results, chrono, fromIndex - 1)
  const after = ranksAsOf(users, results, chrono, toIndex)
  return Object.fromEntries(users.map(u => [u.label, before[u.label] - after[u.label]]))
}

// Each bettor's rank after every played match, chronologically:
// trajectory[label][i] = their cumulative rank as of played match i+1.
export function rankTrajectories(users: User[], results: TournamentResults): Record<string, number[]> {
  const chrono = playedGroupMatchesChrono(results)
  const snapshots = Array.from({ length: chrono.length }, (_, i) => ranksAsOf(users, results, chrono, i + 1))
  return Object.fromEntries(users.map(u => [u.label, snapshots.map(s => s[u.label])]))
}

// Each bettor's hit tally across all played group matches — pgiya (correct
// direction) and tzelifa (exact score) — matching the trajectory's scope, so
// the chart caption can summarise accuracy alongside the rank line.
export function hitStats(users: User[], results: TournamentResults): Record<string, { pgiya: number; tzelifa: number }> {
  const rows = rowsForMatches(users, results, playedGroupMatchesChrono(results), false)
  return Object.fromEntries(rows.map(r => [r.label, { pgiya: r.pgiyaCount, tzelifa: r.tzelifaCount }]))
}

// How many actual R32 matches a bettor "participates" in — they predicted both
// teams that actually reached that matchup (regardless of which side). Fills in
// as the bracket firms up; unresolved slots don't count.
export function countR32Participation(userR32: KnockoutMatch[], actualR32: KnockoutMatch[]): number {
  return actualR32.reduce((n, actual) => {
    const um = userR32.find(m => m.matchNum === actual.matchNum)
    return n + (um && isPlayerParticipatingInKOMatch(actual, um) ? 1 : 0)
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
