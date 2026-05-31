import { GROUPS } from './shared/groups'
import type { TournamentResults, MatchScores } from './shared/types'

// Fill in real scores here as matches are played, keyed by match ID
const groupScores: Record<string, MatchScores> = {
  A1: { home: 2, away: 1 }, // Mexico 2–1 South Africa
}

export const tournamentResults: TournamentResults = {
  groupMatches: Object.fromEntries(
    Object.entries(GROUPS).map(([letter, group]) => [
      letter,
      group.matches.map(m => ({ ...m, scores: groupScores[m.id] ?? { home: null, away: null } })),
    ])
  ),
  groupTables: {},
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
