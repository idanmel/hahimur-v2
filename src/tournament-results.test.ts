// @vitest-environment node
import { expect, test } from 'vitest'
import { derivePlayerGoals, tournamentResults } from './tournament-results'
import { USERS } from './users/index'
import { buildLeaderboardRows } from './leaderboard/leaderboardRows'

test('derivePlayerGoals sums each player\'s goals across matches', () => {
  expect(derivePlayerGoals({
    'קיליאן אמבפה': { C1: 1, F2: 2 },
    'הארי קיין': { B2: 1 },
  })).toEqual({ 'קיליאן אמבפה': 3, 'הארי קיין': 1 })
})

test('tournamentResults carries per-match goals and derives the cumulative tally from them', () => {
  expect(tournamentResults.playerMatchGoals).toBeDefined()
  expect(tournamentResults.playerGoals).toEqual(derivePlayerGoals(tournamentResults.playerMatchGoals!))
})

// The baked results feed the home-page leaderboard. They must carry the derived
// group tables + resolved third-place qualification, not just raw scores —
// otherwise computeGroupBreakdown silently awards 0 advancement/place points and
// the home board shows match points only, diverging from the results page.
test('tournamentResults derives group tables from the entered scores', () => {
  expect(Object.keys(tournamentResults.groupTables).length).toBeGreaterThan(0)
})

test('tournamentResults derives the third-place standings from the entered scores', () => {
  // Not yet resolved (the group stage is still in progress), but the third-placed
  // teams of the groups played so far must be ranked — not the empty stub.
  expect(tournamentResults.thirdPlaceQualification.all.length).toBeGreaterThan(0)
})

test('home leaderboard awards advancement + place points', () => {
  const rows = buildLeaderboardRows(USERS, tournamentResults)
  const someoneAdvanced = rows.some(r => r.group.advancementPoints > 0 || r.group.placePoints > 0)
  expect(someoneAdvanced).toBe(true)
})
