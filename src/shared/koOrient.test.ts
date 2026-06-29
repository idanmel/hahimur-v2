import { describe, it, expect } from 'vitest'
import { isKoReversed, orientKoScore } from './koOrient'

describe('isKoReversed', () => {
  // Match 73 is South Africa (home) vs Canada (away) in our bracket.
  it('is false when ESPN lists the fixture in our orientation', () => {
    expect(isKoReversed(73, 'South Africa', 'Canada')).toBe(false)
  })

  it('is true when ESPN lists home/away the other way round (with an alias)', () => {
    expect(isKoReversed(73, 'Canada', 'South Africa')).toBe(true)
  })

  it('is false for an unresolved/unknown fixture, leaving ESPN order untouched', () => {
    expect(isKoReversed(99, 'Foo', 'Bar')).toBe(false)
  })
})

describe('orientKoScore', () => {
  it('returns the score untouched when not reversed', () => {
    const s = { home: 1, away: 1, drawWinner: 'home' as const }
    expect(orientKoScore(s, false)).toBe(s)
  })

  it('flips home/away and carries the advancer when reversed', () => {
    expect(orientKoScore({ home: 2, away: 1 }, true)).toEqual({ home: 1, away: 2 })
    expect(orientKoScore({ home: 1, away: 1, drawWinner: 'home' }, true))
      .toEqual({ home: 1, away: 1, drawWinner: 'away' })
  })
})
