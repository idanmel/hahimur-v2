import { computeUserPoints } from './points'
import { playedMatchesChrono, resultsAsOf } from './resultsAsOf'
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

// Walk every played match in chronological order; at each step rebuild the
// tournament as it stood right then (resultsAsOf) and read each bettor's total
// straight from the canonical scorer (computeUserPoints) — the exact number the
// leaderboard shows. No tallying is reimplemented here, so the race stays in
// lock-step with the board and follows it automatically into the knockouts.
export function buildRaceFrames(users: User[], results: TournamentResults): RaceFrame[] {
  const chrono = playedMatchesChrono(results)
  return chrono.map((match, i) => {
    const snapshot = resultsAsOf(results, chrono, i + 1)
    const bars = users
      .map(u => ({ label: u.label, total: computeUserPoints(u, snapshot).total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    const home = TEAMS[match.homeTeam]?.he ?? match.homeTeam
    const away = TEAMS[match.awayTeam]?.he ?? match.awayTeam
    return {
      matchId: match.id,
      date: match.date,
      matchLabel: `${home} ${match.scores.home}–${match.scores.away} ${away}`,
      bars,
    }
  })
}
