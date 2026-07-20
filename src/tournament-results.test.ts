// @vitest-environment node
import { expect, test } from 'vitest'
import { buildTournamentResults, derivePlayerGoals, groupScores, koScores, tournamentResults } from './tournament-results'
import { USERS } from './users/index'
import { buildLeaderboardRows } from './leaderboard/leaderboardRows'
import { computeUserPoints, koAdvancementFor, GOLDEN_BOOT_BONUS } from './leaderboard/points'
import { koAdvancer } from './formView/knockout/koRounds'

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

// The baked results must carry the third-place winner and champion the moment
// those scores are entered — computeUserPoints reads results.thirdPlaceWinner /
// results.champion for the 20/25-pt bonuses, while the per-match views derive
// the winner from the score itself. If the fields aren't derived here, the main
// leaderboard silently omits both bonuses and disagrees with every other view.
test('title winners derive from the last two KO scores the moment they are entered', () => {
  const done = buildTournamentResults(groupScores, {
    ...koScores,
    103: { home: 2, away: 1 },
    104: { home: 1, away: 1, drawWinner: 'away' },
  }, {})
  expect(done.thirdPlaceWinner).toBe(done.knockoutStages.thirdPlace[0].home)
  expect(done.champion).toBe(done.knockoutStages.final[0].away)
})

// Same rule against the live data: whatever the entered scores currently decide
// (nothing before the matches, the real winners after) is what the fields carry.
test('baked results agree with the score-derived winners', () => {
  expect(tournamentResults.thirdPlaceWinner).toBe(koAdvancer(tournamentResults.knockoutStages.thirdPlace[0]) ?? undefined)
  expect(tournamentResults.champion).toBe(koAdvancer(tournamentResults.knockoutStages.final[0]) ?? undefined)
})

// The final has been played and the race is over: Mbappé finished top scorer with
// 10, clear of Messi's 8 (checked against the same shootout-filtered ESPN
// accumulation the race board renders from). computeGoldenBootBreakdown pays the
// +10 bonus only off results.goldenBootWinner — the engine deliberately leaves it
// unset while the race is live, so once it's decided the baked results must carry
// the winner or every Mbappé backer is silently denied the bonus forever.
test('golden boot race is locked: Mbappé is the winner and his backers get the bonus', () => {
  expect(tournamentResults.goldenBootWinner).toBe('קיליאן אמבפה')
  const backer = USERS.find(u => u.topGoalscorer === 'קיליאן אמבפה')!
  expect(computeUserPoints(backer, tournamentResults).goldenBoot.winnerBonus).toBe(GOLDEN_BOOT_BONUS)
})

test('main leaderboard total awards the same title bonuses as the per-match views', () => {
  const done = buildTournamentResults(groupScores, {
    ...koScores,
    103: { home: 1, away: 2 },
    104: { home: 1, away: 0 },
  }, {})
  for (const u of USERS) {
    const bd = computeUserPoints(u, done)
    expect(bd.third.thirdPlaceWinner + bd.final.champion).toBe(
      koAdvancementFor(u, done.knockoutStages.thirdPlace[0]) + koAdvancementFor(u, done.knockoutStages.final[0]),
    )
  }
})
