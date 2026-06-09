// @vitest-environment node
import { describe, expect, test } from 'vitest'
import type { Match, MatchScores, Standing } from './types'
import { GROUP_A_MATCHES } from './groups'
import { calculateStandings } from './standings'

function find(standings: Standing[], team: string) {
  const s = standings.find(s => s.team === team)
  if (!s) throw new Error(`Team not found: ${team}`)
  return s
}

function pos(standings: Standing[], team: string) {
  return standings.findIndex(s => s.team === team)
}

// Custom group used for N-team h2h tests.
// Cycle structure: Alpha beats Beta, Beta beats Gamma, Gamma beats Alpha.
// All three beat Delta. Varying scorelines let us control h2h GD vs overall GD.
const FOUR_TEAM_MATCHES: Match[] = [
  { id: 'AB', homeTeam: 'Alpha', awayTeam: 'Beta' },
  { id: 'BC', homeTeam: 'Beta',  awayTeam: 'Gamma' },
  { id: 'GA', homeTeam: 'Gamma', awayTeam: 'Alpha' },
  { id: 'AD', homeTeam: 'Alpha', awayTeam: 'Delta' },
  { id: 'BD', homeTeam: 'Beta',  awayTeam: 'Delta' },
  { id: 'GD', homeTeam: 'Gamma', awayTeam: 'Delta' },
]

describe('Slice 4b-ii — N-team h2h tiebreaker', () => {
  test('3-team h2h GD separates when h2h points are tied (unequal cycle scores)', () => {
    // Alpha beats Beta 3-0, Beta beats Gamma 1-0, Gamma beats Alpha 1-0
    // H2H pts all equal (3). H2H GD: Alpha +2, Gamma 0, Beta -2 → Alpha > Gamma > Beta
    // Beta has best overall GD (+3, from 5-0 vs Delta) — wrong order without h2h
    const predictions: Record<string, MatchScores> = {
      AB: { home: 3, away: 0 },  // Alpha beats Beta 3-0
      BC: { home: 1, away: 0 },  // Beta beats Gamma 1-0
      GA: { home: 1, away: 0 },  // Gamma beats Alpha 1-0
      AD: { home: 1, away: 0 },  // Alpha beats Delta 1-0
      BD: { home: 5, away: 0 },  // Beta beats Delta 5-0 (inflates Beta overall GD)
      GD: { home: 1, away: 0 },  // Gamma beats Delta 1-0
    }
    const { standings } = calculateStandings(FOUR_TEAM_MATCHES, predictions)
    expect(pos(standings, 'Alpha')).toBeLessThan(pos(standings, 'Gamma'))
    expect(pos(standings, 'Gamma')).toBeLessThan(pos(standings, 'Beta'))
  })

  test('3-team equal h2h and equal overall GD: separated by goals scored (criterion e)', () => {
    // Symmetric cycle: Alpha beats Beta 1-0, Beta beats Gamma 1-0, Gamma beats Alpha 1-0
    // Equal h2h (3pts, GD 0, 1 goal each) and equal overall GD (0) for all three.
    // Delta draws vary in scoreline: Alpha 3-3, Beta 2-2, Gamma 1-1
    // Same pts (1) and GD (0) from each draw, but different goals added.
    // Expected: Alpha (4 goals) > Beta (3 goals) > Gamma (2 goals)
    const predictions: Record<string, MatchScores> = {
      AB: { home: 1, away: 0 },
      BC: { home: 1, away: 0 },
      GA: { home: 1, away: 0 },
      AD: { home: 3, away: 3 },
      BD: { home: 2, away: 2 },
      GD: { home: 1, away: 1 },
    }
    const { standings } = calculateStandings(FOUR_TEAM_MATCHES, predictions)
    expect(pos(standings, 'Alpha')).toBeLessThan(pos(standings, 'Beta'))
    expect(pos(standings, 'Beta')).toBeLessThan(pos(standings, 'Gamma'))
  })

  test('3-team equal h2h (symmetric cycle) falls through to overall GD', () => {
    // Alpha beats Beta 1-0, Beta beats Gamma 1-0, Gamma beats Alpha 1-0
    // H2H all equal (3pts, GD 0, 1 goal each) → fall through to overall GD
    // Alpha beats Delta 3-0, Beta 2-0, Gamma 1-0 → overall GD: Alpha +3, Beta +2, Gamma +1
    const predictions: Record<string, MatchScores> = {
      AB: { home: 1, away: 0 },
      BC: { home: 1, away: 0 },
      GA: { home: 1, away: 0 },
      AD: { home: 3, away: 0 },
      BD: { home: 2, away: 0 },
      GD: { home: 1, away: 0 },
    }
    const { standings } = calculateStandings(FOUR_TEAM_MATCHES, predictions)
    expect(pos(standings, 'Alpha')).toBeLessThan(pos(standings, 'Beta'))
    expect(pos(standings, 'Beta')).toBeLessThan(pos(standings, 'Gamma'))
  })
})

describe('Tiebreaker criterion e — most goals scored in all group matches', () => {
  test('team with more goals ranks above team with equal points and equal GD', () => {
    // Mexico and South Korea draw their h2h (A4: 1-1) — h2h cannot separate them.
    // Czech Republic (6pts) and South Africa (3pts) are NOT in the tie.
    // Both Mexico and SK end on 4pts, GD 0. Mexico scored 4 goals overall, South Korea 3.
    const predictions: Record<string, MatchScores> = {
      A1: { home: 2, away: 1 },  // Mexico 2-1 South Africa  (Mexico: 3pts, +1 GD)
      A2: { home: 1, away: 0 },  // South Korea 1-0 Czech Republic (SK: 3pts, +1 GD)
      A3: { home: 1, away: 0 },  // Czech Republic 1-0 South Africa (Czech: 3pts)
      A4: { home: 1, away: 1 },  // Mexico 1-1 South Korea  ← h2h draw
      A5: { home: 2, away: 1 },  // Czech Republic 2-1 Mexico (Mexico: 0pts, -1 GD)
      A6: { home: 2, away: 1 },  // South Africa 2-1 South Korea (SK: 0pts, -1 GD)
    }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)
    expect(pos(standings, 'Mexico')).toBeLessThan(pos(standings, 'South Korea'))
  })
})

describe('Slice 4b-i — 2-team h2h tiebreaker', () => {
  test('h2h win ranks above better overall GD when points are tied', () => {
    // Mexico: 4pts, GD +1 (wins A1, draws A5, loses A4)
    // South Korea: 4pts, GD -1 (wins A4 h2h, draws A6, loses A2)
    // South Korea won the h2h (A4), so SK must rank above Mexico despite worse overall GD
    const predictions: Record<string, MatchScores> = {
      A1: { home: 2, away: 0 },  // Mexico 2-0 South Africa
      A2: { home: 1, away: 3 },  // South Korea 1-3 Czech Republic
      A3: { home: 2, away: 0 },  // Czech Republic 2-0 South Africa
      A4: { home: 0, away: 1 },  // Mexico 0-1 South Korea  ← h2h
      A5: { home: 0, away: 0 },  // Czech Republic 0-0 Mexico
      A6: { home: 0, away: 0 },  // South Africa 0-0 South Korea
    }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)
    expect(pos(standings, 'South Korea')).toBeLessThan(pos(standings, 'Mexico'))
  })
})

describe('tiedTeams — unresolvable ties', () => {
  test('returns empty set when all ties are resolvable', () => {
    const predictions: Record<string, MatchScores> = {
      AB: { home: 1, away: 0 },
      BC: { home: 1, away: 0 },
      GA: { home: 1, away: 0 },
      AD: { home: 3, away: 0 },
      BD: { home: 2, away: 0 },
      GD: { home: 1, away: 0 },
    }
    const { tiedTeams } = calculateStandings(FOUR_TEAM_MATCHES, predictions)
    expect(tiedTeams.size).toBe(0)
  })

  test('returns tied teams when all 5 criteria are exhausted', () => {
    // Symmetric cycle: each beats the next 1-0, all draw 1-1 vs Delta
    // Points: 4 each; overall GD: 0 each; overall goals: 3 each
    // H2H: 3pts, 0 GD, 1 goal each → no resolution possible
    const predictions: Record<string, MatchScores> = {
      AB: { home: 1, away: 0 },
      BC: { home: 1, away: 0 },
      GA: { home: 1, away: 0 },
      AD: { home: 1, away: 1 },
      BD: { home: 1, away: 1 },
      GD: { home: 1, away: 1 },
    }
    const { tiedTeams } = calculateStandings(FOUR_TEAM_MATCHES, predictions)
    expect(tiedTeams).toContain('Alpha')
    expect(tiedTeams).toContain('Beta')
    expect(tiedTeams).toContain('Gamma')
    expect(tiedTeams).not.toContain('Delta')
  })
})

describe('calculateStandings', () => {
  test('home win: Mexico 2-1 South Africa', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 2, away: 1 } }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, points: 3 }
    )
    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 0 }
    )
  })

  test('away win: South Africa 2-0 Mexico', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 0, away: 2 } }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3 }
    )
    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 }
    )
  })

  test('draw: Mexico 1-1 South Africa', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 1, away: 1 } }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1 }
    )
    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1 }
    )
  })

  test('no predictions: all teams show Pld=0', () => {
    const { standings } = calculateStandings(GROUP_A_MATCHES, {})
    expect(standings.every(s => s.played === 0)).toBe(true)
  })

  test('partial prediction (only home score entered): match does not count', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 2, away: null } }
    const { standings } = calculateStandings(GROUP_A_MATCHES, predictions)
    expect(standings.every(s => s.played === 0)).toBe(true)
  })

  test('no predictions: all 4 Group A teams present with zeroed stats', () => {
    const { standings } = calculateStandings(GROUP_A_MATCHES, {})
    expect(standings).toHaveLength(4)
    const zero = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
    expect(standings.every(s => expect(s).toMatchObject(zero))).toBeTruthy()
  })
})
