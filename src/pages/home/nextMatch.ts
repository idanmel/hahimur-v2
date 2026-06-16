import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { tournamentResults } from '../../tournament-results'
import { kickoffDate, MATCH_WINDOW_MS } from '../../shared/matchOrder'
import { scoreFrequencies } from '../match/matchUtils'

// Group-stage matches only for now: knockout fixtures have a different shape
// (matchNum, unresolved team slots) and their own resolution logic.
const MAX_MATCHES = 5

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

// In chronological order, the next few matches (up to MAX_MATCHES) so the home
// page shows what's coming up. A started match still counts until its score is in.
export function nextMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  return timed(matches)
    .filter(x => !hasFinalScore(x.m) && now.getTime() < x.kickoff + MATCH_WINDOW_MS)
    .sort((a, b) => a.kickoff - b.kickoff)
    .slice(0, MAX_MATCHES)
    .map(x => x.m)
}

// The mirror image of nextMatches: the last few matches that already have a
// final score, most recent first, so the home page shows "how it went" without
// digging into each match page.
export function recentMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  return timed(matches)
    .filter(x => hasFinalScore(x.m) && x.kickoff <= now.getTime())
    .sort((a, b) => b.kickoff - a.kickoff)
    .slice(0, MAX_MATCHES)
    .map(x => x.m)
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
