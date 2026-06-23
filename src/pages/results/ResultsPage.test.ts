// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { clampGoals, getLockedMatchIds, allTzelifotResults } from './resultsUtils'
import type { TournamentResults, PredictionsState } from '../../shared/types'

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

describe('allTzelifotResults', () => {
  test('an unplayed match takes my predicted score', () => {
    const base: PredictionsState = { A1: { home: null, away: null } }
    const mine: PredictionsState = { A1: { home: 3, away: 0 } }
    expect(allTzelifotResults(base, mine, new Set())).toEqual({ A1: { home: 3, away: 0 } })
  })

  test('an unplayed knockout match also takes my predicted score', () => {
    const base: PredictionsState = { '73': { home: null, away: null } }
    const mine: PredictionsState = { '73': { home: 2, away: 1 } }
    expect(allTzelifotResults(base, mine, new Set())).toEqual({ '73': { home: 2, away: 1 } })
  })

  test('a played (locked) match keeps reality even when my prediction differs', () => {
    const base: PredictionsState = { A1: { home: 1, away: 1 } }
    const mine: PredictionsState = { A1: { home: 3, away: 0 } }
    expect(allTzelifotResults(base, mine, new Set(['A1']))).toEqual({ A1: { home: 1, away: 1 } })
  })

  test('an unplayed match with no prediction of mine keeps its current value', () => {
    const base: PredictionsState = { A1: { home: null, away: null } }
    expect(allTzelifotResults(base, {}, new Set())).toEqual({ A1: { home: null, away: null } })
  })

  test('only matches present in base are returned (stray predictions ignored)', () => {
    const base: PredictionsState = { A1: { home: null, away: null } }
    const mine: PredictionsState = { A1: { home: 2, away: 1 }, B1: { home: 5, away: 0 } }
    expect(allTzelifotResults(base, mine, new Set())).toEqual({ A1: { home: 2, away: 1 } })
  })
})
