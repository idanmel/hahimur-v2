import { playedMatchesChrono, playedMatchId, playedMatchScores, playedMatchHome, playedMatchAway, playedMatchDate, rowsForPlayedMatches } from './leaderboardRows'
import { TEAMS } from '../shared/groups'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// One bettor's standing within a single frame of the race.
export interface RaceBar {
  label: string
  total: number
}

// A single keyframe of the bar-chart race: the cumulative state of the board
// right after one played match. `date` is the running counter (e.g. "11 ביוני")
// and `matchLabel` the result that produced this frame.
export interface RaceFrame {
  matchId: string
  date: string
  matchLabel: string
  bars: RaceBar[] // sorted descending by total
}

// Walk every played match in chronological order; at each step score the board
// over exactly the matches played so far with the SAME per-match scorer the rank
// trajectory uses (rowsForPlayedMatches). That scorer credits each result the
// moment it happens — a group's advancement/place at its completing match, and
// each knockout fixture's advancer at that very fixture — so a team's deep-run
// bonus never leaks into earlier frames. (The previous resultsAsOf snapshot kept
// the full knockout bracket revealed in every frame, so computeUserPoints handed
// out R32→SF advancement during the group stage, telling a false early story.)
//
// The cumulative total at the final frame equals the live leaderboard for every
// bettor: rowsForPlayedMatches over the whole timeline already reproduces it,
// including the golden-boot winner bonus, which the slice scorer credits to the
// final's frame — exactly where the leaderboard awards it.
export function buildRaceFrames(users: User[], results: TournamentResults): RaceFrame[] {
  const chrono = playedMatchesChrono(results)
  return chrono.map((match, i) => {
    const bars = rowsForPlayedMatches(users, results, chrono.slice(0, i + 1), false)
      .map(r => ({ label: r.label, total: r.total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    const homeCode = playedMatchHome(match)
    const awayCode = playedMatchAway(match)
    const scores = playedMatchScores(match)
    const home = TEAMS[homeCode]?.he ?? homeCode
    const away = TEAMS[awayCode]?.he ?? awayCode
    return {
      matchId: playedMatchId(match),
      date: playedMatchDate(match),
      matchLabel: `${home} ${scores.home}–${scores.away} ${away}`,
      bars,
    }
  })
}
