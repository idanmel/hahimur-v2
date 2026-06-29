import { describe, it, expect } from 'vitest'
import { mapLiveEvents, type LiveEvent } from './espnLive'

function ev(over: Partial<LiveEvent>): LiveEvent {
  return {
    id: null,
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

  it('marks an in-progress match as live with its minute and current score', () => {
    const { live } = mapLiveEvents([
      ev({ home: 'England', away: 'Croatia', homeScore: 1, awayScore: 0, clock: "67'" }),
    ])
    expect(live).toEqual({ L1: { clock: "67'", home: 1, away: 0 } })
  })

  it('carries the live score in fixture orientation when ESPN lists teams reversed', () => {
    // Fixture L1 is England (home) vs Croatia (away); ESPN reversed here.
    const { live } = mapLiveEvents([
      ev({ home: 'Croatia', away: 'England', homeScore: 2, awayScore: 1, clock: "67'" }),
    ])
    expect(live).toEqual({ L1: { clock: "67'", home: 1, away: 2 } })
  })

  it('marks a live match without a reported score using just its minute', () => {
    const { live } = mapLiveEvents([
      ev({ home: 'England', away: 'Croatia', homeScore: null, awayScore: null, clock: "2'" }),
    ])
    expect(live).toEqual({ L1: { clock: "2'" } })
  })

  it('does not mark a completed match as live', () => {
    const { live } = mapLiveEvents([
      ev({ state: 'post', completed: true, home: 'England', away: 'Croatia', homeScore: 3, awayScore: 1, clock: "90'" }),
    ])
    expect(live).toEqual({})
  })

  it('maps a knockout match to its matchNum by ESPN event id', () => {
    // matchNum 73 (ESPN id 760486) is South Africa vs Canada.
    const { scores, live } = mapLiveEvents([
      ev({ id: '760486', home: 'South Africa', away: 'Canada', homeScore: 1, awayScore: 0, clock: "35'" }),
    ])
    expect(scores).toEqual({ '73': { home: 1, away: 0 } })
    expect(live).toEqual({ '73': { clock: "35'", home: 1, away: 0 } })
  })

  it('orients a knockout score when ESPN lists the teams reversed vs our fixture', () => {
    // Fixture 73 is South Africa (home) vs Canada (away); ESPN reversed here.
    const { scores, live } = mapLiveEvents([
      ev({ id: '760486', home: 'Canada', away: 'South Africa', homeScore: 0, awayScore: 2, clock: "70'" }),
    ])
    expect(scores).toEqual({ '73': { home: 2, away: 0 } })
    expect(live).toEqual({ '73': { clock: "70'", home: 2, away: 0 } })
  })

  it('counts a picked player\'s knockout goal too', () => {
    const { goals } = mapLiveEvents([
      ev({ id: '760486', home: 'South Africa', away: 'Canada', homeScore: 1, awayScore: 0, scorers: ['Harry Kane'] }),
    ])
    expect(goals).toEqual({ 'הארי קיין': { '73': 1 } })
  })

  it('still skips a knockout pairing that arrives without a known event id', () => {
    const { scores } = mapLiveEvents([
      ev({ id: null, home: 'England', away: 'Spain', homeScore: 1, awayScore: 1 }),
    ])
    expect(scores).toEqual({})
  })
})
