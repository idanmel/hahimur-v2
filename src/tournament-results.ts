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
  C2: { home: 0, away: 1 },
  D2: { home: 2, away: 0 },
  E1: { home: 7, away: 1 },
  F1: { home: 2, away: 2 },
  E2: { home: 1, away: 0 },
  F2: { home: 5, away: 1 },
  H1: { home: 0, away: 0 },
  G1: { home: 1, away: 1 },
  H2: { home: 1, away: 1 },
  G2: { home: 2, away: 2 },
  I1: { home: 3, away: 1 },
  I2: { home: 1, away: 4 },
  J1: { home: 3, away: 0 },
  J2: { home: 3, away: 1 },
  K1: { home: 1, away: 1 },
  L1: { home: 4, away: 2 },
  L2: { home: 1, away: 0 },
  K2: { home: 1, away: 3 },
  A3: { home: 1, away: 1 },
  B3: { home: 4, away: 1 },
  B4: { home: 6, away: 0 },
  A4: { home: 1, away: 0 },
  D3: { home: 2, away: 0 },
  C3: { home: 0, away: 1 },
  C4: { home: 3, away: 0 },
  D4: { home: 0, away: 1 },
  F3: { home: 5, away: 1 },
  E3: { home: 2, away: 1 },
  E4: { home: 0, away: 0 },
  F4: { home: 0, away: 4 },
  H3: { home: 4, away: 0 },
  G3: { home: 0, away: 0 },
  H4: { home: 2, away: 2 },
  G4: { home: 1, away: 3 },
  J3: { home: 2, away: 0 },
  I3: { home: 3, away: 0 },
  I4: { home: 3, away: 2 },
  J4: { home: 1, away: 2 },
  K3: { home: 5, away: 0 },
  L3: { home: 0, away: 0 },
  L4: { home: 0, away: 1 },
  K4: { home: 1, away: 0 },
}

// Real goals by picked players: player → match ID → goals in that match.
// Names must match users' topGoalscorer strings exactly.
const realGoals: Record<string, Record<string, number>> = {
  'ויניסיוס ג׳וניור': { C1: 1, C4: 1 },
  'קאי האברץ': { E1: 2 },
  'קיליאן אמבפה': { I1: 2, I3: 2 },
  'הארי קיין': { L1: 2 },
  'לאמין ימאל': { H3: 1 },
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
