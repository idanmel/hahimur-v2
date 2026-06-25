import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { tournamentResults } from '../../tournament-results'
import { kickoffDate, MATCH_WINDOW_MS } from '../../shared/matchOrder'
import { scoreFrequencies } from '../match/matchUtils'

// Group-stage matches only for now: knockout fixtures have a different shape
// (matchNum, unresolved team slots) and their own resolution logic.
//
// The home page shows a 15-hour burst of matches rather than a fixed count: it
// anchors on the closest match and includes every match within 15h of it. This
// keeps a day's fixtures together even across midnight — a 23:00 match and the
// 02:00 one three hours later belong to the same burst, which calendar-date
// grouping would wrongly split — while a match a full day away stays out.
const WINDOW_MS = 15 * 60 * 60 * 1000

// The default match pool the home-page cards select from: every group match,
// carrying whatever scores have been recorded so far.
export const SCORED_MATCHES = Object.values(tournamentResults.groupMatches).flat()

type Timed = { m: GroupMatch; kickoff: number }

// Pairs each match with its kickoff instant, dropping any without a parseable date.
function timed(matches: GroupMatch[]): Timed[] {
  return matches
    .map(m => ({ m, kickoff: kickoffDate(m.matchDate, m.kickoffIST)?.getTime() }))
    .filter((x): x is Timed => x.kickoff !== undefined)
}

// A match is settled once it has a final score recorded.
function hasFinalScore(m: GroupMatch): boolean {
  return m.scores?.home != null && m.scores?.away != null
}

// Every upcoming match within 15h of the closest one, in chronological order,
// so the home page shows the coming burst of fixtures. A started match still
// counts until its score is in.
export function nextMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  const upcoming = timed(matches)
    .filter(x => !hasFinalScore(x.m) && now.getTime() < x.kickoff + MATCH_WINDOW_MS)
    .sort((a, b) => a.kickoff - b.kickoff)
  return withinWindowOfFirst(upcoming)
}

// The mirror image of nextMatches: every played match within 24h of the most
// recent one, newest first, so the home page shows "how it went" without
// digging into each match page.
export function recentMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  const played = timed(matches)
    .filter(x => hasFinalScore(x.m) && x.kickoff <= now.getTime())
    .sort((a, b) => b.kickoff - a.kickoff)
  return withinWindowOfFirst(played)
}

// Given matches already sorted in the desired order, keeps just those whose
// kickoff is within 15h of the first (anchor) match. Empty in, empty out.
function withinWindowOfFirst(sorted: Timed[]): GroupMatch[] {
  const anchor = sorted[0]?.kickoff
  if (anchor === undefined) return []
  return sorted.filter(x => Math.abs(x.kickoff - anchor) < WINDOW_MS).map(x => x.m)
}

export interface TopPrediction {
  home: number
  away: number
  count: number
  total: number
}

export function topPrediction(users: User[], matchId: string): TopPrediction | null {
  let top: { key: string; count: number } | null = null
  let total = 0
  for (const [key, count] of scoreFrequencies(users, matchId)) {
    total += count
    if (!top || count > top.count) top = { key, count }
  }
  if (!top) return null
  const [home, away] = top.key.split('-').map(Number)
  return { home, away, count: top.count, total }
}
