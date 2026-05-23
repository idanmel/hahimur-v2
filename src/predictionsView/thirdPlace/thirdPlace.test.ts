import { describe, expect, test } from 'vitest'
import type { Match, MatchScores, Standing, ThirdPlaceStanding } from '../../shared/types'
import { calculateStandings } from '../../shared/standings'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from './thirdPlace'

function st(team: string, points: number, goalsFor: number, goalsAgainst: number): Standing {
  return { team, points, played: 3, won: 0, drawn: 0, lost: 0, goalsFor, goalsAgainst }
}

function grp(letter: string, ...standings: Standing[]) {
  return { group: letter, standings }
}

// A 4-team round-robin used for reactivity tests.
// Matches between Alpha/Beta/Gamma/Delta, labeled T1–T6.
const TEST_MATCHES: Match[] = [
  { id: 'T1', homeTeam: 'Alpha', awayTeam: 'Beta' },
  { id: 'T2', homeTeam: 'Gamma', awayTeam: 'Delta' },
  { id: 'T3', homeTeam: 'Alpha', awayTeam: 'Gamma' },
  { id: 'T4', homeTeam: 'Beta',  awayTeam: 'Delta' },
  { id: 'T5', homeTeam: 'Alpha', awayTeam: 'Delta' },
  { id: 'T6', homeTeam: 'Beta',  awayTeam: 'Gamma' },
]

// Scenario 1: Alpha 1st (9pts), Beta 2nd (6pts), Delta 3rd (3pts), Gamma 4th (0pts)
const PREDS_DELTA_THIRD: Record<string, MatchScores> = {
  T1: { home: 1, away: 0 }, // Alpha beats Beta
  T2: { home: 0, away: 1 }, // Delta beats Gamma
  T3: { home: 1, away: 0 }, // Alpha beats Gamma
  T4: { home: 1, away: 0 }, // Beta beats Delta
  T5: { home: 1, away: 0 }, // Alpha beats Delta
  T6: { home: 1, away: 0 }, // Beta beats Gamma
}

// Scenario 2: same except T2 flips → Alpha 1st, Beta 2nd, Gamma 3rd (3pts), Delta 4th (0pts)
const PREDS_GAMMA_THIRD: Record<string, MatchScores> = {
  ...PREDS_DELTA_THIRD,
  T2: { home: 1, away: 0 }, // Gamma beats Delta (flipped)
}

describe('getThirdPlaceTeams', () => {
  test('returns the team ranked 3rd in each group', () => {
    const input = [
      grp('A', st('Alpha', 9, 6, 0), st('Beta', 6, 3, 1), st('Gamma', 3, 1, 2), st('Delta', 0, 0, 7)),
      grp('B', st('Uno', 9, 5, 0), st('Dos', 6, 4, 2), st('Tres', 3, 2, 3), st('Cuatro', 0, 0, 6)),
    ]
    const result = getThirdPlaceTeams(input)
    expect(result[0].team).toBe('Gamma')
    expect(result[1].team).toBe('Tres')
  })

  test('labels each team with their source group', () => {
    const input = [
      grp('A', st('Alpha', 9, 6, 0), st('Beta', 6, 3, 1), st('Gamma', 3, 1, 2), st('Delta', 0, 0, 7)),
      grp('B', st('Uno', 9, 5, 0), st('Dos', 6, 4, 2), st('Tres', 3, 2, 3), st('Cuatro', 0, 0, 6)),
    ]
    const result = getThirdPlaceTeams(input)
    expect(result[0].group).toBe('A')
    expect(result[1].group).toBe('B')
  })

  test('returns one entry per group', () => {
    const input = [
      grp('A', st('Alpha', 9, 6, 0), st('Beta', 6, 3, 1), st('Gamma', 3, 1, 2), st('Delta', 0, 0, 7)),
      grp('B', st('Uno', 9, 5, 0), st('Dos', 6, 4, 2), st('Tres', 3, 2, 3), st('Cuatro', 0, 0, 6)),
      grp('C', st('P', 9, 5, 0), st('Q', 6, 4, 2), st('R', 3, 2, 3), st('S', 0, 0, 6)),
    ]
    const result = getThirdPlaceTeams(input)
    expect(result).toHaveLength(3)
  })
})

describe('getThirdPlaceTeams — result sensitivity', () => {
  test('reflects a team moving from 3rd to 2nd when their result improves', () => {
    // Gamma wins T2: Gamma moves from 4th (0pts) to 3rd (3pts), Delta drops to 4th
    const { standings: standingsBefore } = calculateStandings(TEST_MATCHES, PREDS_DELTA_THIRD)
    const { standings: standingsAfter }  = calculateStandings(TEST_MATCHES, PREDS_GAMMA_THIRD)

    const before = getThirdPlaceTeams([{ group: 'X', standings: standingsBefore }])
    const after  = getThirdPlaceTeams([{ group: 'X', standings: standingsAfter }])

    expect(before[0].team).toBe('Delta')
    expect(after[0].team).toBe('Gamma')
  })

  test('reflects a team dropping from 3rd to 4th when their result worsens', () => {
    // Reversing: with PREDS_GAMMA_THIRD, Delta is 4th; flip back to PREDS_DELTA_THIRD, Delta is 3rd
    const { standings: standingsWithDeltaOut }  = calculateStandings(TEST_MATCHES, PREDS_GAMMA_THIRD)
    const { standings: standingsWithDeltaBack } = calculateStandings(TEST_MATCHES, PREDS_DELTA_THIRD)

    const withDeltaOut  = getThirdPlaceTeams([{ group: 'X', standings: standingsWithDeltaOut }])
    const withDeltaBack = getThirdPlaceTeams([{ group: 'X', standings: standingsWithDeltaBack }])

    expect(withDeltaOut[0].team).not.toBe('Delta')
    expect(withDeltaBack[0].team).toBe('Delta')
  })
})

function makeDistinct12(): ThirdPlaceStanding[] {
  return 'ABCDEFGHIJKL'.split('').map((g, i) => ({
    ...st(`Team${g}`, (12 - i) * 3, 12 - i, i),
    group: g,
  }))
}

function makeFillerTeams(): ThirdPlaceStanding[] {
  return 'CDEFGHIJKL'.split('').map((g, i) => ({ ...st(`T${g}`, i, i, 0), group: g }))
}

describe('qualifyBestThirdPlace', () => {
  describe('given all teams have distinct stats', () => {
    test('resolves the qualification', () => {
      const result = qualifyBestThirdPlace(makeDistinct12())
      expect(result.resolved).toBe(true)
    })

    test('ranks by points, highest first', () => {
      const teams: ThirdPlaceStanding[] = [
        { ...st('Low',  3, 1, 0), group: 'A' },
        { ...st('High', 9, 3, 0), group: 'B' },
        { ...st('Mid',  6, 2, 0), group: 'C' },
        { ...st('T4',   0, 0, 1), group: 'D' },
        { ...st('T5',   0, 0, 2), group: 'E' },
        { ...st('T6',   0, 0, 3), group: 'F' },
        { ...st('T7',   0, 0, 4), group: 'G' },
        { ...st('T8',   0, 0, 5), group: 'H' },
        { ...st('T9',   0, 0, 6), group: 'I' },
        { ...st('T10',  0, 0, 7), group: 'J' },
        { ...st('T11',  0, 0, 8), group: 'K' },
        { ...st('T12',  0, 0, 9), group: 'L' },
      ]
      const result = qualifyBestThirdPlace(teams)
      if (!result.resolved) throw new Error('expected resolved')
      expect(result.qualifiers[0].team).toBe('High')
      expect(result.qualifiers[1].team).toBe('Mid')
      expect(result.qualifiers[2].team).toBe('Low')
    })

    test('when points are equal, ranks by goal difference', () => {
      // Two teams with 6pts: BetterGD has +3, WorseGD has +1
      const teams: ThirdPlaceStanding[] = [
        { ...st('WorseGD',  6, 4, 3), group: 'A' }, // GD +1
        { ...st('BetterGD', 6, 5, 2), group: 'B' }, // GD +3
        ...makeFillerTeams(),
      ]
      const result = qualifyBestThirdPlace(teams)
      if (!result.resolved) throw new Error('expected resolved')
      const betterIdx = result.qualifiers.findIndex(t => t.team === 'BetterGD')
      const worseIdx  = result.qualifiers.findIndex(t => t.team === 'WorseGD')
      expect(betterIdx).toBeLessThan(worseIdx)
    })

    test('when points and GD are equal, ranks by goals scored', () => {
      // Two teams with 6pts, GD +1: MoreGoals scored 4 (4-3), FewerGoals scored 2 (2-1)
      const teams: ThirdPlaceStanding[] = [
        { ...st('FewerGoals', 6, 2, 1), group: 'A' }, // GD +1, GF 2
        { ...st('MoreGoals',  6, 4, 3), group: 'B' }, // GD +1, GF 4
        ...makeFillerTeams(),
      ]
      const result = qualifyBestThirdPlace(teams)
      if (!result.resolved) throw new Error('expected resolved')
      const moreIdx  = result.qualifiers.findIndex(t => t.team === 'MoreGoals')
      const fewerIdx = result.qualifiers.findIndex(t => t.team === 'FewerGoals')
      expect(moreIdx).toBeLessThan(fewerIdx)
    })

    test('returns exactly the top 8 as qualifiers', () => {
      const result = qualifyBestThirdPlace(makeDistinct12())
      if (!result.resolved) throw new Error('expected resolved')
      expect(result.qualifiers).toHaveLength(8)
      // Top 8 are TeamA (36pts) through TeamH (15pts)
      expect(result.qualifiers.map(t => t.team)).toEqual(
        ['TeamA','TeamB','TeamC','TeamD','TeamE','TeamF','TeamG','TeamH']
      )
    })
  })

  describe('given any two teams share identical pts + GD + goals scored', () => {
    test('reports the qualification as unresolved when tie straddles the cutoff', () => {
      const teams = makeDistinct12()
      // Make team at index 7 (TeamH) identical to team at index 8 (TeamI)
      teams[8] = { ...teams[7], team: 'TeamI', group: 'I' }
      const result = qualifyBestThirdPlace(teams)
      expect(result.resolved).toBe(false)
    })

    test('names all teams involved in the tie', () => {
      const teams = makeDistinct12()
      teams[8] = { ...teams[7], team: 'TeamI', group: 'I' }
      const result = qualifyBestThirdPlace(teams)
      if (result.resolved) throw new Error('expected unresolved')
      const tiedNames = result.tied.map(t => t.team).sort()
      expect(tiedNames).toContain('TeamH')
      expect(tiedNames).toContain('TeamI')
    })

    test('resolves when the tie does not straddle the cutoff', () => {
      const teams = makeDistinct12()
      // Make indices 5 and 6 identical — both safely inside the top 8
      teams[6] = { ...teams[5], team: 'TeamG', group: 'G' }
      const result = qualifyBestThirdPlace(teams)
      expect(result.resolved).toBe(true)
    })
  })

  describe('given fewer than 8 groups have a third-place finisher', () => {
    test('resolves with fewer than 8 qualifiers', () => {
      const teams: ThirdPlaceStanding[] = [
        { ...st('TeamA', 9, 3, 0), group: 'A' },
        { ...st('TeamB', 6, 2, 0), group: 'B' },
        { ...st('TeamC', 3, 1, 0), group: 'C' },
      ]
      const result = qualifyBestThirdPlace(teams)
      expect(result.resolved).toBe(true)
      if (!result.resolved) throw new Error()
      expect(result.qualifiers).toHaveLength(3)
    })
  })
})
