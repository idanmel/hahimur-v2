// @vitest-environment node
import { describe, expect, test } from 'vitest'
import type { Standing, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { computeUserPoints, singleMatchOutcome, OLEH_POINTS, PLACE_POINT } from './points'
import { EMPTY_RESULTS, makeUser } from './testFixtures'

test('returns all-zero breakdown with empty results', () => {
  const user = makeUser({ groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] } })
  expect(computeUserPoints(user, EMPTY_RESULTS)).toEqual({
    group:      { matchPoints: 0, advancementPoints: 0, placePoints: 0, total: 0 },
    r32:        { matchPoints: 0, advancementPoints: 0, total: 0 },
    r16:        { matchPoints: 0, advancementPoints: 0, total: 0 },
    qf:         { matchPoints: 0, advancementPoints: 0, total: 0 },
    sf:         { matchPoints: 0, advancementPoints: 0, total: 0 },
    third:      { matchPoints: 0, thirdPlaceWinner: 0, total: 0 },
    final:      { matchPoints: 0, champion: 0, total: 0 },
    goldenBoot: { goalsPoints: 0, winnerBonus: 0, total: 0 },
    total: 0,
  })
})

describe('group match points', () => {
  test('exact group score earns 4 pts (צליפה)', () => {
    const user = makeUser({
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] },
    }
    expect(computeUserPoints(user, results).group.total).toBe(4)
  })

  test('correct result, wrong score earns 2 pts (פגיעה)', () => {
    const user = makeUser({
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 1, away: 0 } }] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 3, away: 1 } }] },
    }
    expect(computeUserPoints(user, results).group.total).toBe(2)
  })

  test('wrong result earns 0 pts', () => {
    const user = makeUser({
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 0 } }] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 0, away: 1 } }] },
    }
    expect(computeUserPoints(user, results).group.total).toBe(0)
  })
})

const grpRow = (team: string, played: number, won: number, drawn: number, lost: number, gf: number, ga: number, pts: number): Standing =>
  ({ team, played, won, drawn, lost, goalsFor: gf, goalsAgainst: ga, points: pts })

describe('R32 qualification points', () => {
  test('both top-2 teams correct → 2 × עולה pts', () => {
    const user = makeUser({
      groupTables: { A: [
        grpRow('Brazil',  3, 3, 0, 0, 6, 0, 9),
        grpRow('France',  3, 2, 0, 1, 4, 2, 6),
        grpRow('Germany', 3, 1, 0, 2, 2, 4, 3),
        grpRow('Spain',   3, 0, 0, 3, 0, 6, 0),
      ]},
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [
        grpRow('Brazil',  3, 3, 0, 0, 6, 0, 9),
        grpRow('France',  3, 2, 0, 1, 4, 2, 6),
        grpRow('Germany', 3, 1, 0, 2, 2, 4, 3),
        grpRow('Spain',   3, 0, 0, 3, 0, 6, 0),
      ]},
    }
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(2 * OLEH_POINTS.group)
  })

  test('one top-2 team correct → 1 × עולה pts', () => {
    const user = makeUser({
      groupTables: { A: [
        grpRow('Brazil',  3, 3, 0, 0, 6, 0, 9),
        grpRow('France',  3, 2, 0, 1, 4, 2, 6),
        grpRow('Germany', 3, 1, 0, 2, 2, 4, 3),
        grpRow('Spain',   3, 0, 0, 3, 0, 6, 0),
      ]},
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [
        grpRow('Brazil',  3, 3, 0, 0, 6, 0, 9),
        grpRow('Germany', 3, 2, 0, 1, 4, 2, 6),
        grpRow('France',  3, 1, 0, 2, 2, 4, 3),
        grpRow('Spain',   3, 0, 0, 3, 0, 6, 0),
      ]},
    }
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(OLEH_POINTS.group)
  })

  test('predicted top-2, team qualified via third place → עולה pts', () => {
    const s = (team: string, pos: number): ThirdPlaceStanding => ({
      team, played: 3, won: 3 - pos, drawn: 0, lost: pos, goalsFor: 6 - pos * 2, goalsAgainst: pos * 2, points: 9 - pos * 3, group: 'A',
    })
    const user = makeUser({
      groupTables: { A: [s('Brazil', 0), s('France', 1), s('Germany', 2), s('Spain', 3)] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [s('France', 0), s('Germany', 1), s('Brazil', 2), s('Spain', 3)] },
      thirdPlaceQualification: { resolved: true, all: [s('Brazil', 2)], qualifiers: [s('Brazil', 2)] },
    }
    // France: predicted top-2, finished top-2; Brazil: predicted top-2, qualified via third place
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(2 * OLEH_POINTS.group)
  })

  test('predicted third-place qualifier, team finished top-2 → עולה pts', () => {
    const s = (team: string, pos: number): ThirdPlaceStanding => ({
      team, played: 3, won: 3 - pos, drawn: 0, lost: pos, goalsFor: 6 - pos * 2, goalsAgainst: pos * 2, points: 9 - pos * 3, group: 'A',
    })
    const user = makeUser({
      groupTables: { A: [s('France', 0), s('Germany', 1), s('Brazil', 2), s('Spain', 3)] },
      thirdPlaceQualification: { resolved: true, all: [s('Brazil', 2)], qualifiers: [s('Brazil', 2)] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [s('Brazil', 0), s('France', 1), s('Germany', 2), s('Spain', 3)] },
      // thirdPlaceQualification not resolved — Brazil came top-2, not third place
    }
    // France: predicted top-2, finished top-2 (עולה)
    // Germany: predicted top-2, finished 3rd (0)
    // Brazil: predicted third-place qualifier, but finished top-2 — still advanced (עולה)
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(2 * OLEH_POINTS.group)
  })

  test('all 8 third-place qualifiers correct → 8 × עולה pts', () => {
    const teams = ['T1','T2','T3','T4','T5','T6','T7','T8'].map(team => ({
      team, played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3, group: 'A',
    }))
    const user = makeUser({
      thirdPlaceQualification: { resolved: true, all: teams, qualifiers: teams },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      thirdPlaceQualification: { resolved: true, all: teams, qualifiers: teams },
    }
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(8 * OLEH_POINTS.group)
  })

  test('no points when group table not in results', () => {
    const user = makeUser({
      groupTables: { A: [grpRow('Brazil', 3, 3, 0, 0, 6, 0, 9), grpRow('France', 3, 2, 0, 1, 4, 2, 6)] },
    })
    expect(computeUserPoints(user, EMPTY_RESULTS).group.advancementPoints).toBe(0)
  })

  test('no points when group not yet complete (played=0)', () => {
    const user = makeUser({
      groupTables: { A: [grpRow('Brazil', 3, 3, 0, 0, 6, 0, 9), grpRow('France', 3, 2, 0, 1, 4, 2, 6)] },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [
        grpRow('Brazil', 0, 0, 0, 0, 0, 0, 0),
        grpRow('France', 0, 0, 0, 0, 0, 0, 0),
        grpRow('Germany', 0, 0, 0, 0, 0, 0, 0),
        grpRow('Spain', 0, 0, 0, 0, 0, 0, 0),
      ]},
    }
    expect(computeUserPoints(user, results).group.advancementPoints).toBe(0)
  })

  test('no points for third-place qualifier when results not resolved', () => {
    const teams = ['T1','T2'].map(team => ({
      team, played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3, group: 'A',
    }))
    const user = makeUser({
      thirdPlaceQualification: { resolved: true, all: teams, qualifiers: teams },
    })
    expect(computeUserPoints(user, EMPTY_RESULTS).group.advancementPoints).toBe(0)
  })

})

describe('group place points', () => {
  const table = (...teams: string[]) => teams.map(t => grpRow(t, 3, 1, 1, 1, 3, 3, 4))

  test('all 4 places correct → 4 × place pts, on top of עולה pts', () => {
    const user = makeUser({
      groupTables: { A: table('Brazil', 'France', 'Germany', 'Spain') },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: table('Brazil', 'France', 'Germany', 'Spain') },
    }
    const group = computeUserPoints(user, results).group
    expect(group.placePoints).toBe(4 * PLACE_POINT)
    expect(group.total).toBe(2 * OLEH_POINTS.group + 4 * PLACE_POINT)
  })

  test('two places correct (middle pair swapped) → 2 × place pts', () => {
    const user = makeUser({
      groupTables: { A: table('Brazil', 'France', 'Germany', 'Spain') },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: table('Brazil', 'Germany', 'France', 'Spain') },
    }
    expect(computeUserPoints(user, results).group.placePoints).toBe(2 * PLACE_POINT)
  })

  test('no place pts while group not yet complete', () => {
    const user = makeUser({
      groupTables: { A: table('Brazil', 'France', 'Germany', 'Spain') },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: ['Brazil', 'France', 'Germany', 'Spain'].map(t => grpRow(t, 1, 1, 0, 0, 2, 0, 3)) },
    }
    expect(computeUserPoints(user, results).group.placePoints).toBe(0)
  })

  test('no place pts when user did not predict the group', () => {
    const user = makeUser({})
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: table('Brazil', 'France', 'Germany', 'Spain') },
    }
    expect(computeUserPoints(user, results).group.placePoints).toBe(0)
  })
})

describe('knockout match points', () => {
  test('R32 exact score with same teams → 7 pts in r32 bucket', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    expect(computeUserPoints(user, results).r32.total).toBe(7)
  })

  test('R32 match skipped when teams differ (participation check)', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Germany', away: 'Spain', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    expect(computeUserPoints(user, results).r32.total).toBe(0)
  })

  test('same teams in same stage but different slot → participates and scores', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [{ matchNum: 74, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    expect(computeUserPoints(user, results).r32.total).toBe(7)
  })

  test('same teams but flipped home/away in different slot → scores correctly', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    // France is home in actual, Brazil is away — user predicted Brazil(home) 2-1 France(away)
    // After flip: predicted becomes { home: 1, away: 2 } (France's perspective)
    // Actual: France 0-2 Brazil → winner is away (Brazil) → pagiya (correct winner, wrong score)
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [{ matchNum: 74, home: 'France', away: 'Brazil', resolved: true, scores: { home: 0, away: 2 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    expect(computeUserPoints(user, results).r32.total).toBe(5) // pagiya: Brazil wins in both
  })

  test('flipped home/away with exact mirrored score → tzelifa', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [{ matchNum: 73, home: 'Brazil', away: 'France', resolved: true, scores: { home: 2, away: 1 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    // After flip: predicted becomes { home: 1, away: 2 } → matches actual exactly
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [{ matchNum: 74, home: 'France', away: 'Brazil', resolved: true, scores: { home: 1, away: 2 } }],
        r16: [], qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    expect(computeUserPoints(user, results).r32.total).toBe(7) // tzelifa
  })

  test('Final exact score → 25 pts in final bucket', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [], r16: [], qf: [], sf: [], thirdPlace: [],
        final: [{ matchNum: 104, home: 'Brazil', away: 'France', resolved: true, scores: { home: 1, away: 0 } }],
      },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [], r16: [], qf: [], sf: [], thirdPlace: [],
        final: [{ matchNum: 104, home: 'Brazil', away: 'France', resolved: true, scores: { home: 1, away: 0 } }],
      },
    }
    expect(computeUserPoints(user, results).final.total).toBe(25)
  })
})

describe('knockout advancement (עולה)', () => {
  test('R32 advancement: עולה pts per correctly predicted R16 team', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [],
        r16: [{ matchNum: 89, home: 'Brazil', away: 'France', resolved: false }],
        qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        r32: [],
        r16: [{ matchNum: 89, home: 'Brazil', away: 'Germany', resolved: false }],
        qf: [], sf: [], thirdPlace: [], final: [],
      },
    }
    // Brazil correct (עולה), France wrong (0), Germany not predicted (0)
    expect(computeUserPoints(user, results).r32.total).toBe(OLEH_POINTS.r32)
  })

  test('R32 advancement: no points when R16 not yet populated in results', () => {
    const user = makeUser({
      knockoutStages: {
        r32: [],
        r16: [{ matchNum: 89, home: 'Brazil', away: 'France', resolved: false }],
        qf: [], sf: [], thirdPlace: [], final: [],
      },
    })
    expect(computeUserPoints(user, EMPTY_RESULTS).r32.total).toBe(0)
  })
})

describe('champion and third-place winner', () => {
  test('correct champion prediction → champion pts in final bucket', () => {
    const user = makeUser({ predictedChampion: 'Brazil' })
    const results: TournamentResults = { ...EMPTY_RESULTS, champion: 'Brazil' }
    expect(computeUserPoints(user, results).final.total).toBe(OLEH_POINTS.champion)
  })

  test('wrong champion prediction → 0', () => {
    const user = makeUser({ predictedChampion: 'France' })
    const results: TournamentResults = { ...EMPTY_RESULTS, champion: 'Brazil' }
    expect(computeUserPoints(user, results).final.total).toBe(0)
  })

  test('correct third-place winner → thirdPlaceWinner pts in third bucket', () => {
    const user = makeUser({ predictedThirdPlaceWinner: 'Argentina' })
    const results: TournamentResults = { ...EMPTY_RESULTS, thirdPlaceWinner: 'Argentina' }
    expect(computeUserPoints(user, results).third.total).toBe(OLEH_POINTS.thirdPlaceWinner)
  })

  test('no champion points when results has no champion', () => {
    const user = makeUser({ predictedChampion: 'Brazil' })
    expect(computeUserPoints(user, EMPTY_RESULTS).final.total).toBe(0)
  })
})

describe('golden boot (מלך שערים)', () => {
  test('3 pts per goal scored by predicted player', () => {
    const user = makeUser({ topGoalscorer: 'Messi' })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      goldenBootWinner: 'Ronaldo',
      playerGoals: { Messi: 5, Ronaldo: 7 },
    }
    expect(computeUserPoints(user, results).goldenBoot.total).toBe(15)
  })

  test('+10 bonus if predicted player wins golden boot', () => {
    const user = makeUser({ topGoalscorer: 'Messi' })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      goldenBootWinner: 'Messi',
      playerGoals: { Messi: 6 },
    }
    expect(computeUserPoints(user, results).goldenBoot.total).toBe(28) // 6×3 + 10
  })

  test('0 pts when no goals and no winner yet', () => {
    const user = makeUser({ topGoalscorer: 'Messi' })
    expect(computeUserPoints(user, EMPTY_RESULTS).goldenBoot.total).toBe(0)
  })

  test('goals points awarded even when no golden boot winner selected yet', () => {
    const user = makeUser({ topGoalscorer: 'Messi' })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      playerGoals: { Messi: 4 },
    }
    expect(computeUserPoints(user, results).goldenBoot).toEqual({ goalsPoints: 12, winnerBonus: 0, total: 12 })
  })

  test('multiple tied golden boot winners each earn +10 bonus', () => {
    const userA = makeUser({ topGoalscorer: 'Messi' })
    const userB = makeUser({ topGoalscorer: 'Ronaldo' })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      goldenBootWinner: ['Messi', 'Ronaldo'],
      playerGoals: { Messi: 7, Ronaldo: 7 },
    }
    expect(computeUserPoints(userA, results).goldenBoot).toEqual({ goalsPoints: 21, winnerBonus: 10, total: 31 })
    expect(computeUserPoints(userB, results).goldenBoot).toEqual({ goalsPoints: 21, winnerBonus: 10, total: 31 })
  })

  test('0 pts when predicted player scored no goals', () => {
    const user = makeUser({ topGoalscorer: 'Messi' })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      goldenBootWinner: 'Ronaldo',
      playerGoals: { Ronaldo: 7 },
    }
    expect(computeUserPoints(user, results).goldenBoot.total).toBe(0)
  })
})

test('total is sum of all buckets', () => {
  const user = makeUser({
    groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] },
    predictedChampion: 'Brazil',
    topGoalscorer: 'Messi',
  })
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] },
    champion: 'Brazil',
    goldenBootWinner: 'Messi',
    playerGoals: { Messi: 3 },
  }
  const bd = computeUserPoints(user, results)
  expect(bd.total).toBe(bd.group.total + bd.r32.total + bd.r16.total + bd.qf.total + bd.sf.total + bd.third.total + bd.final.total + bd.goldenBoot.total)
})

describe('singleMatchOutcome', () => {
  test('exact score → tzelifa', () => {
    expect(singleMatchOutcome({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe('tzelifa')
  })

  test('correct winner, wrong score → pgiya', () => {
    expect(singleMatchOutcome({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe('pgiya')
  })

  test('wrong winner → miss', () => {
    expect(singleMatchOutcome({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe('miss')
  })

  test('predicted draw, actual non-draw → miss', () => {
    expect(singleMatchOutcome({ home: 1, away: 1 }, { home: 2, away: 1 })).toBe('miss')
  })

  test('unpredicted score → miss', () => {
    expect(singleMatchOutcome({ home: null, away: null }, { home: 2, away: 1 })).toBe('miss')
  })

  test('no result yet → miss', () => {
    expect(singleMatchOutcome({ home: 1, away: 0 }, { home: null, away: null })).toBe('miss')
  })
})
