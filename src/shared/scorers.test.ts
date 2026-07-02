import { describe, it, expect } from 'vitest'
import { PICKED_SCORERS, SCORER_ALIASES } from './scorers'
import { USERS } from '../users/index'
import { tournamentResults } from '../tournament-results'

// A player name is identity here: points, live goals, and the race board all
// join on the exact Hebrew string. These tests make a mismatch loud instead of
// silently zeroing someone's golden-boot points.
describe('PICKED_SCORERS registry', () => {
  it('covers every distinct topGoalscorer pick', () => {
    const canonical = new Set(Object.keys(PICKED_SCORERS))
    const unknownPicks = USERS.map(u => u.topGoalscorer).filter(p => !canonical.has(p))
    expect(unknownPicks).toEqual([])
  })

  it('covers every player with entered real goals', () => {
    const canonical = new Set(Object.keys(PICKED_SCORERS))
    const unknownScorers = Object.keys(tournamentResults.playerMatchGoals ?? {})
      .filter(p => !canonical.has(p))
    expect(unknownScorers).toEqual([])
  })

  it('maps every source spelling to its canonical Hebrew name', () => {
    for (const [he, { sourceNames }] of Object.entries(PICKED_SCORERS)) {
      for (const src of sourceNames) {
        expect(SCORER_ALIASES[src]).toBe(he)
      }
    }
  })
})
