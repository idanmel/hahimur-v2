import { GROUPS } from './shared/groups'
import type { TournamentResults, MatchScores } from './shared/types'

// Fill in real scores here as matches are played, keyed by match ID
const groupScores: Record<string, MatchScores> = {
  A1: { home: 2, away: 0 },
  A2: { home: 2, away: 1 },
  B1: { home: 1, away: 1 },
  D1: { home: 4, away: 1 },
  B2: { home: 1, away: 1 },
  C1: { home: 1, away: 1 },
}

// Real goals by picked players: player → match ID → goals in that match.
// Names must match users' topGoalscorer strings exactly.
const realGoals: Record<string, Record<string, number>> = {
}

export function derivePlayerGoals(perMatch: Record<string, Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(perMatch).map(([player, byMatch]) =>
      [player, Object.values(byMatch).reduce((sum, goals) => sum + goals, 0)])
  )
}

export const tournamentResults: TournamentResults = {
  groupMatches: Object.fromEntries(
    Object.entries(GROUPS).map(([letter, group]) => [
      letter,
      group.matches.map(m => ({ ...m, scores: groupScores[m.id] ?? { home: null, away: null } })),
    ])
  ),
  groupTables: {},
  playerMatchGoals: realGoals,
  playerGoals: derivePlayerGoals(realGoals),
  thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: {
    r32: [],
    r16: [],
    qf: [],
    sf: [],
    thirdPlace: [],
    final: [],
  },
}
