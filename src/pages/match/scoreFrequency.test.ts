// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { buildScoreFrequency } from './scoreFrequency'
import type { User } from '../../users/index'
import type { MatchScores } from '../../shared/types'

function u(label: string, score: MatchScores | null): User {
  return {
    label,
    predictions: score ? { M1: score } : {},
    topGoalscorer: '',
    groupMatches: {},
    groupTables: {},
    thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] },
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  }
}

test('empty user list yields no rows and no unpredicted', () => {
  expect(buildScoreFrequency('M1', [])).toEqual({
    rows: [],
    unpredicted: [],
    recap: { exact: 0, partial: 0, miss: 0 },
  })
})

describe('grouping', () => {
  test('groups identical scorelines into one row and counts them', () => {
    const { rows } = buildScoreFrequency('M1', [u('א', { home: 2, away: 1 }), u('ב', { home: 2, away: 1 }), u('ג', { home: 0, away: 0 })])
    expect(rows).toHaveLength(2)
    const win = rows.find(r => r.key === '2-1-')!
    expect(win.count).toBe(2)
    expect(win.names).toEqual(['א', 'ב'])
  })

  test('sorts names within a row in Hebrew order', () => {
    const { rows } = buildScoreFrequency('M1', [u('עידן', { home: 2, away: 1 }), u('אורן', { home: 2, away: 1 })])
    expect(rows[0].names).toEqual(['אורן', 'עידן'])
  })

  test('unpredicted users land in their own sorted list, not in rows', () => {
    const { rows, unpredicted } = buildScoreFrequency('M1', [
      u('עידן', { home: 2, away: 1 }),
      u('מנחה', null),
      u('אבי', { home: null, away: null }),
    ])
    expect(rows).toHaveLength(1)
    expect(unpredicted).toEqual(['אבי', 'מנחה'])
  })

  test('a knockout draw splits by drawWinner via scoreFor', () => {
    const users = [u('בית', { home: 1, away: 1, drawWinner: 'home' }), u('חוץ', { home: 1, away: 1, drawWinner: 'away' })]
    const { rows } = buildScoreFrequency('73', users, null, u => u.predictions.M1)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.key).sort()).toEqual(['1-1-away', '1-1-home'])
  })
})

describe('count, percentage and leader', () => {
  test('percentage is the share of predicted users, rounded', () => {
    const { rows } = buildScoreFrequency('M1', [u('א', { home: 2, away: 1 }), u('ב', { home: 2, away: 1 }), u('ג', { home: 0, away: 0 })])
    expect(rows.find(r => r.key === '2-1-')!.pct).toBe(67)
    expect(rows.find(r => r.key === '0-0-')!.pct).toBe(33)
  })

  test('only the most-predicted scoreline(s) are leaders', () => {
    const { rows } = buildScoreFrequency('M1', [u('א', { home: 2, away: 1 }), u('ב', { home: 2, away: 1 }), u('ג', { home: 0, away: 0 })])
    expect(rows.find(r => r.key === '2-1-')!.isLeader).toBe(true)
    expect(rows.find(r => r.key === '0-0-')!.isLeader).toBe(false)
  })
})

describe('sort order', () => {
  test('home wins, then draws, then away wins', () => {
    const { rows } = buildScoreFrequency('M1', [
      u('away', { home: 0, away: 2 }),
      u('draw', { home: 1, away: 1 }),
      u('home', { home: 2, away: 0 }),
    ])
    expect(rows.map(r => r.key)).toEqual(['2-0-', '1-1-', '0-2-'])
  })
})

describe('scoring against a real result', () => {
  const actual: MatchScores = { home: 2, away: 1 }
  const users = [u('בול', { home: 2, away: 1 }), u('כיוון', { home: 1, away: 0 }), u('פספוס', { home: 0, away: 3 })]

  test('each row carries its outcome and points', () => {
    const { rows } = buildScoreFrequency('M1', users, actual)
    const by = (key: string) => rows.find(r => r.key === key)!
    expect(by('2-1-')).toMatchObject({ outcome: 'tzelifa', pts: 4 })
    expect(by('1-0-')).toMatchObject({ outcome: 'pgiya', pts: 2 })
    expect(by('0-3-')).toMatchObject({ outcome: 'miss', pts: 0 })
  })

  test('recap tallies exact / partial / miss across all predictors', () => {
    const { recap } = buildScoreFrequency('M1', [...users, u('בול ב', { home: 2, away: 1 }), u('ריק', null)], actual)
    expect(recap).toEqual({ exact: 2, partial: 1, miss: 1 })
  })

  test('without a real result, outcome and points are null and recap is zero', () => {
    const { rows, recap } = buildScoreFrequency('M1', users)
    expect(rows.every(r => r.outcome === null && r.pts === null)).toBe(true)
    expect(recap).toEqual({ exact: 0, partial: 0, miss: 0 })
  })
})
