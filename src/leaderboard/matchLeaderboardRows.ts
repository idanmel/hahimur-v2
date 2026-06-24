import { isUnpredicted, type MatchScores, type TournamentResults } from '../shared/types'
import type { User } from '../users'
import { matchSortKey } from '../shared/matchOrder'
import { playedGroupMatchesChrono, rangePlaceMovement, rowsForMatches } from './leaderboardRows'

export interface MatchLeaderRow {
  label: string
  // The bettor's predicted score, or null if they didn't predict this match.
  prediction: MatchScores | null
  // Points this match earned them (the bet outcome plus any goals their picked
  // scorer netted here, and group position points on a completing match) —
  // provisional while the match is live.
  matchPoints: number
  // Advancement bonus credited at this match: a group's correct qualifiers land
  // on its completing match; a knockout match credits its winner's round bonus.
  advancementPoints: number
  // Running tournament total through this match in schedule order; later matches,
  // even already-played ones, are deliberately excluded.
  total: number
  // Places climbed (+) or dropped (-) in the overall standings because of this
  // match. Null for the first played match and before kickoff — no prior standing.
  placeMovement: number | null
}

export function buildMatchLeaderboardRows(users: User[], results: TournamentResults, matchId: string): MatchLeaderRow[] {
  const chrono = playedGroupMatchesChrono(results)
  const playedIndex = chrono.findIndex(m => m.id === matchId) + 1 // 1-based; 0 if not played yet
  const thisMatch = playedIndex > 0 ? chrono[playedIndex - 1] : null

  // How many played matches fall at or before this one in the schedule — the
  // cutoff for the cumulative total. For a played match that's its own index;
  // before kickoff it's the matches scheduled earlier.
  const scheduled = results.groupMatches[matchId[0]]?.find(m => m.id === matchId)
  const refKey = scheduled ? matchSortKey(scheduled.matchDate, scheduled.kickoffIST) : Infinity
  const upTo = playedIndex > 0 ? playedIndex : chrono.filter(m => matchSortKey(m.matchDate, m.kickoffIST) <= refKey).length

  const cumulative = rowsForMatches(users, results, chrono.slice(0, upTo), false)
  const thisMatchRows = thisMatch ? rowsForMatches(users, results, [thisMatch], false) : null
  const movement = playedIndex > 0 ? rangePlaceMovement(users, results, playedIndex, playedIndex) : null

  return users
    .map((user, i) => {
      const p = user.predictions[matchId]
      // Advancement is broken out into its own column; the remaining bet, place
      // and goals points stay in matchPoints.
      const advancementPoints = thisMatchRows ? thisMatchRows[i].advancementPoints : 0
      return {
        label: user.label,
        prediction: p && !isUnpredicted(p) ? p : null,
        matchPoints: thisMatchRows ? thisMatchRows[i].total - advancementPoints : 0,
        advancementPoints,
        total: cumulative[i].total,
        placeMovement: movement ? movement[user.label] : null,
      }
    })
    .sort((a, b) => b.total - a.total || b.matchPoints - a.matchPoints || a.label.localeCompare(b.label, 'he'))
}
