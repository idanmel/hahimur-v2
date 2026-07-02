import type { PredictionsState, TournamentResults } from '../../shared/types'
import { isUnpredicted } from '../../shared/types'
import { TEAMS } from '../../shared/groups'
import { playedMatchesChrono, playedMatchId, playedMatchScores, playedMatchHome, playedMatchAway } from '../leaderboardRows'
import type { PlayedMatch } from '../leaderboardRows'

const teamHe = (team: string) => TEAMS[team]?.he ?? team

// The real, actually-played results (group + knockout) as a PredictionsState
// keyed exactly the way the sim engine expects: 'A1'..'L6' for groups, the
// match number as a string for knockout. Manual what-if edits never reach here.
export function realPlayedState(results: TournamentResults): PredictionsState {
  const played: PredictionsState = {}
  for (const matches of Object.values(results.groupMatches ?? {})) {
    for (const m of matches) {
      if (m.scores && !isUnpredicted(m.scores)) played[m.id] = m.scores
    }
  }
  for (const matches of Object.values(results.knockoutStages ?? {})) {
    for (const m of matches) {
      if (m.scores && !isUnpredicted(m.scores)) played[String(m.matchNum)] = m.scores
    }
  }
  return played
}

// The win-prob "point in time" picker label for a played match: "בית N - N חוץ".
export function winProbMatchLabel(p: PlayedMatch): string {
  const s = playedMatchScores(p)
  return `${teamHe(playedMatchHome(p))} ${s.home ?? 0} - ${s.away ?? 0} ${teamHe(playedMatchAway(p))}`
}

// Played matches in chronological order — the same unified group+knockout
// timeline the leaderboard walks, so the win-prob picker stays in lock-step.
export function playedChrono(results: TournamentResults): PlayedMatch[] {
  return playedMatchesChrono(results)
}

export function lastPlayedMatch(results: TournamentResults): PlayedMatch | null {
  const chrono = playedChrono(results)
  return chrono.length ? chrono[chrono.length - 1] : null
}

// Played-state as it stood right after `throughId` (inclusive), in chronological
// order. Used to view the win-probabilities "as of" an earlier point in time.
export function playedStateUpTo(chrono: PlayedMatch[], throughId: string): PredictionsState {
  const state: PredictionsState = {}
  for (const m of chrono) {
    state[playedMatchId(m)] = playedMatchScores(m)
    if (playedMatchId(m) === throughId) break
  }
  return state
}
