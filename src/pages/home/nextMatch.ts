import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { kickoffDate, MATCH_WINDOW_MS } from '../../shared/matchOrder'
import { scoreFrequencies } from '../match/matchUtils'

// Group-stage matches only for now: knockout fixtures have a different shape
// (matchNum, unresolved team slots) and their own resolution logic.
// A started match still counts until its final score is recorded.
// Returns, in chronological order, the next few matches (up to MAX_MATCHES) so
// the home page shows what's coming up, not just one match.
const MAX_MATCHES = 5

export function nextMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  return matches
    .map(m => ({ m, kickoff: kickoffDate(m.matchDate, m.kickoffIST)?.getTime() }))
    .filter((x): x is { m: GroupMatch; kickoff: number } => {
      if (x.kickoff === undefined) return false
      const ended = x.m.scores?.home != null && x.m.scores?.away != null
      if (ended) return false
      return now.getTime() < x.kickoff + MATCH_WINDOW_MS
    })
    .sort((a, b) => a.kickoff - b.kickoff)
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
