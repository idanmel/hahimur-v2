// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { clampGoals, getLockedMatchIds } from './ResultsPage'
import type { TournamentResults } from '../../shared/types'

const EMPTY_RESULTS: TournamentResults = {
  groupMatches: {},
  groupTables: {},
  thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
}

describe('clampGoals', () => {
  test('entered value below real count is clamped to real count', () => {
    expect(clampGoals(5, 3)).toBe(5)
  })

  test('entered value above real count is accepted as-is', () => {
    expect(clampGoals(5, 8)).toBe(8)
  })

  test('entered value equal to real count is accepted', () => {
    expect(clampGoals(5, 5)).toBe(5)
  })

  test('no real data (0) allows any non-negative value', () => {
    expect(clampGoals(0, 4)).toBe(4)
  })
})

describe('getLockedMatchIds', () => {
  test('group match with both scores is locked', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 2, away: 1 } }] },
    }
    expect(getLockedMatchIds(results).has('A1')).toBe(true)
  })

  test('group match with null scores is not locked', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: null, away: null } }] },
    }
    expect(getLockedMatchIds(results).has('A1')).toBe(false)
  })

  test('group match with only one score is not locked', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 1, away: null } }] },
    }
    expect(getLockedMatchIds(results).has('A1')).toBe(false)
  })

  test('knockout match with both scores is locked', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r32: [{ matchNum: 73, home: 'X', away: 'Y', resolved: true, scores: { home: 1, away: 0 } }],
      },
    }
    expect(getLockedMatchIds(results).has('73')).toBe(true)
  })

  test('knockout match with null scores is not locked', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r32: [{ matchNum: 73, home: 'X', away: 'Y', resolved: false }],
      },
    }
    expect(getLockedMatchIds(results).has('73')).toBe(false)
  })
})
