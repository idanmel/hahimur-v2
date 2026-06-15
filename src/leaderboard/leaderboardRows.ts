import { computeUserPoints, computeGroupBreakdown, singleMatchOutcome, singleMatchPoints, POINTS_PER_GOAL } from './points'
import type { GroupLetter } from '../shared/groups'
import { isUnpredicted } from '../shared/types'
import type { GroupMatch, MatchScores, ThirdPlaceQualification, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { matchSortKey } from '../shared/matchOrder'
import { competitionRanks } from './rank'
import type { User } from '../users'

export type Scope = 'all' | GroupLetter | 'range'

function scopeThirdPlace(q: ThirdPlaceQualification, scope: GroupLetter): ThirdPlaceQualification {
  const inScope = (teams: ThirdPlaceStanding[]) => teams.filter(t => t.group === scope)
  return q.resolved
    ? { resolved: true, all: inScope(q.all), qualifiers: inScope(q.qualifiers) }
    : { resolved: false, all: inScope(q.all), tied: inScope(q.tied) }
}

export function buildLeaderboardRows(users: User[], results: TournamentResults) {
  return users
    .map(user => ({ label: user.label, ...computeUserPoints(user, results) }))
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
}

export type GroupSortBy = 'pgiya' | 'tzelifa' | 'combined' | 'matchPoints' | 'advancementPoints' | 'placePoints' | 'goalsPoints' | 'total' | 'tournamentTotal'

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
}

export function playedGroupMatchesChrono(results: TournamentResults): GroupMatch[] {
  return Object.values(results.groupMatches).flat()
    .filter(m => m.scores && !isUnpredicted(m.scores))
    .sort((a, b) => matchSortKey(a.matchDate, a.kickoffIST) - matchSortKey(b.matchDate, b.kickoffIST))
}

export function rowsForMatches(users: User[], results: TournamentResults, matches: GroupMatch[]): GroupScopeRow[] {
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
    return { label: user.label, tzelifaCount, pgiyaCount, matchPoints, advancementPoints: 0, placePoints: 0, goalsPoints, total: matchPoints + goalsPoints, tournamentTotal: computeUserPoints(user, results).total }
  })
}

// Points gained over a chosen stretch — played group matches from `fromIndex`
// through `toIndex` (1-based, inclusive) in chronological order. A form table:
// sort by total to see who gained the most across the stretch.
export function buildRangeRows(users: User[], results: TournamentResults, fromIndex: number, toIndex: number): GroupScopeRow[] {
  return rowsForMatches(users, results, playedGroupMatchesChrono(results).slice(fromIndex - 1, toIndex))
}

// How many places each bettor moved in the cumulative standings across the
// stretch: their rank just before it (as of match fromIndex-1) vs at its end
// (as of match toIndex). Positive = climbed, negative = dropped, 0 = held.
// Null when the stretch starts at game 1 — there's no "before" to compare to.
// Each bettor's cumulative rank as of the first `count` played matches.
function ranksAsOf(users: User[], results: TournamentResults, chrono: GroupMatch[], count: number): Record<string, number> {
  const rows = rowsForMatches(users, results, chrono.slice(0, count)).sort(GROUP_SORTERS.total)
  const ranks = competitionRanks(rows, r => r.total)
  return Object.fromEntries(rows.map((r, i) => [r.label, ranks[i]]))
}

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
