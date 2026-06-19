import type { MatchScores, PredictionsState, TournamentResults } from '../../shared/types'
import { isUnpredicted } from '../../shared/types'
import { TEAMS } from '../../shared/groups'
import { matchSortKey } from '../../shared/matchOrder'

export interface PlayedMatch {
  id: string
  label: string
  // team codes (as the sim engine / predictions key them) + final score,
  // so the win-prob view can explain who the player had backed.
  home: string
  away: string
  homeScore: number
  awayScore: number
  // full score object (incl. knockout drawWinner) keyed as the engine expects,
  // so we can rebuild the played-state truncated to any point in time.
  scores: MatchScores
}

const teamHe = (team: string) => TEAMS[team]?.he ?? team

// The real, actually-played results (group + knockout) as a PredictionsState
// keyed exactly the way the sim engine expects: 'A1'..'L6' for groups, the
// match number as a string for knockout. Manual "סימלוץ" edits never reach here.
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

// Played matches in chronological order (matches without a date sort last,
// so knockout games naturally follow the group stage).
export function playedChrono(results: TournamentResults): PlayedMatch[] {
  const list: (PlayedMatch & { sortKey: number })[] = []
  for (const matches of Object.values(results.groupMatches)) {
    for (const m of matches) {
      if (m.scores && !isUnpredicted(m.scores)) {
        list.push({
          id: m.id,
          label: `${teamHe(m.homeTeam)} ${m.scores.home} - ${m.scores.away} ${teamHe(m.awayTeam)}`,
          home: m.homeTeam,
          away: m.awayTeam,
          homeScore: m.scores.home ?? 0,
          awayScore: m.scores.away ?? 0,
          scores: m.scores,
          sortKey: matchSortKey(m.matchDate, m.kickoffIST),
        })
      }
    }
  }
  for (const matches of Object.values(results.knockoutStages)) {
    for (const m of matches) {
      if (m.scores && !isUnpredicted(m.scores)) {
        list.push({
          id: String(m.matchNum),
          label: `${teamHe(m.home)} ${m.scores.home} - ${m.scores.away} ${teamHe(m.away)}`,
          home: m.home,
          away: m.away,
          homeScore: m.scores.home ?? 0,
          awayScore: m.scores.away ?? 0,
          scores: m.scores,
          sortKey: matchSortKey(m.matchDate, m.kickoffIST),
        })
      }
    }
  }
  return list
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ id, label, home, away, homeScore, awayScore, scores }) => ({
      id,
      label,
      home,
      away,
      homeScore,
      awayScore,
      scores,
    }))
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
    state[m.id] = m.scores
    if (m.id === throughId) break
  }
  return state
}
