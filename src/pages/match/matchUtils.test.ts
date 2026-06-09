// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { findMatch, resolveMatch, resultGroup, compareScores } from './matchUtils'

describe('resultGroup', () => {
  test('home win returns 0', () => expect(resultGroup(2, 0)).toBe(0))
  test('draw returns 1', () => expect(resultGroup(1, 1)).toBe(1))
  test('away win returns 2', () => expect(resultGroup(0, 3)).toBe(2))
})

describe('compareScores', () => {
  test('home win sorts before draw', () => expect(compareScores(1, 0, 0, 0)).toBeLessThan(0))
  test('draw sorts before away win', () => expect(compareScores(1, 1, 0, 2)).toBeLessThan(0))
  test('home win sorts before away win', () => expect(compareScores(2, 1, 1, 2)).toBeLessThan(0))
  test('within home wins: lower home goals sorts first', () => expect(compareScores(1, 0, 2, 0)).toBeLessThan(0))
  test('within draws: lower goals sorts first', () => expect(compareScores(0, 0, 1, 1)).toBeLessThan(0))
  test('within away wins: lower away goals sorts first', () => expect(compareScores(0, 1, 0, 2)).toBeLessThan(0))
  test('equal scores return 0', () => expect(compareScores(2, 1, 2, 1)).toBe(0))
})

describe('findMatch', () => {
  test('returns match for known id', () => {
    const match = findMatch('A1')
    expect(match).not.toBeNull()
    expect(match?.id).toBe('A1')
  })

  test('returns null for unknown id', () => {
    expect(findMatch('DOESNOTEXIST')).toBeNull()
  })
})

describe('resolveMatch', () => {
  test('returns match and teams for known id', () => {
    const { match, home, away } = resolveMatch('A1')
    expect(match?.id).toBe('A1')
    expect(home).not.toBeNull()
    expect(away).not.toBeNull()
    expect(home?.iso).toBeDefined()
    expect(away?.he).toBeDefined()
  })

  test('returns all nulls for null matchId', () => {
    const { match, home, away } = resolveMatch(null)
    expect(match).toBeNull()
    expect(home).toBeNull()
    expect(away).toBeNull()
  })

  test('returns all nulls for unknown matchId', () => {
    const { match, home, away } = resolveMatch('DOESNOTEXIST')
    expect(match).toBeNull()
    expect(home).toBeNull()
    expect(away).toBeNull()
  })
})
