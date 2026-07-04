import { GROUPS } from './shared/groups.ts'
import type { TournamentResults, MatchScores, PredictionsState } from './shared/types'
import { deriveGroupStatus } from './shared/groupStatus.ts'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from './formView/thirdPlace/thirdPlace.ts'
import { deriveKnockoutStages } from './formView/knockout/deriveKnockoutStages.ts'
// Real goals by picked players: player → match ID → goals in that match.
// Lives in real-goals.json so the cron (scripts/results-file.ts) can read and
// write it as plain JSON. Keys must be canonical PICKED_SCORERS names
// (shared/scorers.ts) — the registry test fails on any other name.
import realGoals from './real-goals.json' with { type: 'json' }

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
  B6: { home: 3, away: 1 },
  B5: { home: 2, away: 1 },
  C6: { home: 4, away: 2 },
  C5: { home: 0, away: 3 },
  A5: { home: 0, away: 3 },
  A6: { home: 1, away: 0 },
  E5: { home: 0, away: 2 },
  E6: { home: 2, away: 1 },
  F6: { home: 1, away: 3 },
  F5: { home: 1, away: 1 },
  D6: { home: 0, away: 0 },
  D5: { home: 3, away: 2 },
  I5: { home: 1, away: 4 },
  I6: { home: 5, away: 0 },
  H5: { home: 0, away: 0 },
  H6: { home: 0, away: 1 },
  G6: { home: 1, away: 5 },
  G5: { home: 1, away: 1 },
  L5: { home: 0, away: 2 },
  L6: { home: 2, away: 1 },
  K5: { home: 0, away: 0 },
  K6: { home: 3, away: 1 },
  J5: { home: 3, away: 3 },
  J6: { home: 1, away: 3 },
}

// Knockout results: the regulation (90') score keyed by matchNum. drawWinner
// names the advancer when regulation ended level (ET/penalties decide who went
// through). Fill in as KO matches are played; knockoutStages is derived from this.
const koScores: Record<string, MatchScores> = {
  73: { home: 0, away: 1 },
  74: { home: 1, away: 1, drawWinner: 'away' },
  75: { home: 1, away: 1, drawWinner: 'away' },
  76: { home: 2, away: 1 },
  77: { home: 3, away: 0 },
  78: { home: 1, away: 2 },
  79: { home: 2, away: 0 },
  80: { home: 2, away: 1 },
  81: { home: 2, away: 0 },
  82: { home: 2, away: 2, drawWinner: 'home' },
  83: { home: 2, away: 1 },
  84: { home: 3, away: 0 },
  85: { home: 2, away: 0 },
  86: { home: 1, away: 1, drawWinner: 'home' },
  87: { home: 1, away: 0 },
  88: { home: 1, away: 1, drawWinner: 'away' },
}

export function derivePlayerGoals(perMatch: Record<string, Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(perMatch).map(([player, byMatch]) =>
      [player, Object.values(byMatch).reduce((sum, goals) => sum + goals, 0)])
  )
}

// Derive the group tables and third-place qualification straight from the
// entered scores, exactly as the results page does. The leaderboard awards
// advancement/place points off these — leaving them empty would silently zero
// those points everywhere `tournamentResults` is read (e.g. the home board).
const groupPredictions: PredictionsState = { ...groupScores }
const { allGroupData, allGroupsFilled } = deriveGroupStatus(groupPredictions)
const groupTables = Object.fromEntries(allGroupData.map(d => [d.group, d.standings]))
const thirdPlaceTeams = getThirdPlaceTeams(allGroupData)
const thirdPlaceQualification = allGroupsFilled
  ? qualifyBestThirdPlace(thirdPlaceTeams)
  : { resolved: false as const, all: thirdPlaceTeams, tied: [] }

export const tournamentResults: TournamentResults = {
  groupMatches: Object.fromEntries(
    Object.entries(GROUPS).map(([letter, group]) => [
      letter,
      group.matches.map(m => ({ ...m, scores: groupScores[m.id] ?? { home: null, away: null } })),
    ])
  ),
  groupTables,
  playerMatchGoals: realGoals,
  playerGoals: derivePlayerGoals(realGoals),
  thirdPlaceQualification,
  knockoutStages: deriveKnockoutStages(groupScores, koScores),
}
