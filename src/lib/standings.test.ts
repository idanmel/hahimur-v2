import { describe, expect, test } from 'vitest'
import type { MatchScores } from '../types'
import { GROUP_A_MATCHES } from './groups'
import { calculateStandings } from './standings'

function find(standings: ReturnType<typeof calculateStandings>, team: string) {
  const s = standings.find(s => s.team === team)
  if (!s) throw new Error(`Team not found: ${team}`)
  return s
}

describe('calculateStandings', () => {
  test('home win: Mexico 2-1 South Africa', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 2, away: 1 } }
    const standings = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, points: 3 }
    )
    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 0 }
    )
  })

  test('away win: South Africa 2-0 Mexico', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 0, away: 2 } }
    const standings = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3 }
    )
    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 }
    )
  })

  test('draw: Mexico 1-1 South Africa', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 1, away: 1 } }
    const standings = calculateStandings(GROUP_A_MATCHES, predictions)

    expect(find(standings, 'Mexico')).toMatchObject(
      { played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1 }
    )
    expect(find(standings, 'South Africa')).toMatchObject(
      { played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1 }
    )
  })

  test('no predictions: all teams show Pld=0', () => {
    const standings = calculateStandings(GROUP_A_MATCHES, {})
    expect(standings.every(s => s.played === 0)).toBe(true)
  })

  test('partial prediction (only home score entered): match does not count', () => {
    const predictions: Record<string, MatchScores> = { A1: { home: 2, away: null } }
    const standings = calculateStandings(GROUP_A_MATCHES, predictions)
    expect(standings.every(s => s.played === 0)).toBe(true)
  })

  test('no predictions: all 4 Group A teams present with zeroed stats', () => {
    const standings = calculateStandings(GROUP_A_MATCHES, {})
    expect(standings).toHaveLength(4)
    const zero = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
    expect(standings.every(s => expect(s).toMatchObject(zero))).toBeTruthy()
  })
})
