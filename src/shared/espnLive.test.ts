import { describe, it, expect } from 'vitest'
import { mapLiveEvents, type LiveEvent } from './espnLive'

function ev(over: Partial<LiveEvent>): LiveEvent {
  return {
    state: 'in',
    completed: false,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    scorers: [],
    ...over,
  }
}

describe('mapLiveEvents', () => {
  it('maps an in-progress group match to its id', () => {
    // L1 is England vs Croatia
    const { scores } = mapLiveEvents([
      ev({ home: 'England', away: 'Croatia', homeScore: 1, awayScore: 0 }),
    ])
    expect(scores).toEqual({ L1: { home: 1, away: 0 } })
  })

  it('flips home/away when ESPN lists them reversed vs the fixture', () => {
    // Fixture L1 is England (home) vs Croatia (away); ESPN reversed here.
    const { scores } = mapLiveEvents([
      ev({ home: 'Croatia', away: 'England', homeScore: 2, awayScore: 1 }),
    ])
    expect(scores).toEqual({ L1: { home: 1, away: 2 } })
  })

  it('applies team name aliases', () => {
    // A2 is South Korea vs Czech Republic
    const { scores } = mapLiveEvents([
      ev({ home: 'Korea Republic', away: 'Czechia', homeScore: 0, awayScore: 0 }),
    ])
    expect(scores).toEqual({ A2: { home: 0, away: 0 } })
  })

  it('includes completed events too', () => {
    const { scores } = mapLiveEvents([
      ev({ state: 'post', completed: true, home: 'England', away: 'Croatia', homeScore: 3, awayScore: 1 }),
    ])
    expect(scores).toEqual({ L1: { home: 3, away: 1 } })
  })

  it('skips pre-match events', () => {
    const { scores } = mapLiveEvents([
      ev({ state: 'pre', home: 'England', away: 'Croatia', homeScore: null, awayScore: null }),
    ])
    expect(scores).toEqual({})
  })

  it('skips pairings that are not a group fixture (e.g. knockout)', () => {
    const { scores } = mapLiveEvents([
      ev({ home: 'England', away: 'Spain', homeScore: 1, awayScore: 1 }),
    ])
    expect(scores).toEqual({})
  })

  it('counts goals only for allowlisted picked players, keyed by match', () => {
    const { goals } = mapLiveEvents([
      ev({
        home: 'Germany',
        away: 'Curaçao', // E1
        homeScore: 2,
        awayScore: 0,
        scorers: ['Kai Havertz', 'Kai Havertz', 'Some Other Player'],
      }),
    ])
    expect(goals).toEqual({ 'קאי האברץ': { E1: 2 } })
  })

  it('ignores a goal in a non-group (unmapped) match', () => {
    const { goals } = mapLiveEvents([
      ev({ home: 'England', away: 'Spain', scorers: ['Harry Kane'] }),
    ])
    expect(goals).toEqual({})
  })
})
