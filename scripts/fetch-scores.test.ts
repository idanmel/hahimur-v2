import { describe, it, expect } from 'vitest'
import { extractGroupScores, type ApiMatch } from './fetch-scores'

function apiMatch(over: Partial<ApiMatch> & { home: string; away: string }): ApiMatch {
  return {
    status: 'FINISHED',
    stage: 'GROUP_STAGE',
    homeTeam: { name: over.home },
    awayTeam: { name: over.away },
    score: { fullTime: { home: 1, away: 0 } },
    ...over,
  }
}

describe('extractGroupScores', () => {
  it('maps a finished match to its match ID by team names', () => {
    const { scores } = extractGroupScores([
      apiMatch({ home: 'Mexico', away: 'South Africa', score: { fullTime: { home: 2, away: 1 } } }),
    ])
    expect(scores).toEqual({ A1: { home: 2, away: 1 } })
  })

  it('ignores matches that have not finished', () => {
    const { scores } = extractGroupScores([
      apiMatch({ home: 'Mexico', away: 'South Africa', status: 'IN_PLAY' }),
      apiMatch({ home: 'Canada', away: 'Bosnia and Herzegovina', status: 'TIMED', score: { fullTime: { home: null, away: null } } }),
    ])
    expect(scores).toEqual({})
  })

  it('ignores knockout-stage matches', () => {
    const { scores, unmapped } = extractGroupScores([
      apiMatch({ home: 'Mexico', away: 'South Africa', stage: 'LAST_32' }),
    ])
    expect(scores).toEqual({})
    expect(unmapped).toEqual([])
  })

  it('swaps the score when the API home/away order is reversed', () => {
    const { scores } = extractGroupScores([
      apiMatch({ home: 'South Africa', away: 'Mexico', score: { fullTime: { home: 1, away: 3 } } }),
    ])
    expect(scores).toEqual({ A1: { home: 3, away: 1 } })
  })

  it('resolves football-data.org team names that differ from ours', () => {
    const { scores, unmapped } = extractGroupScores([
      apiMatch({ home: 'Korea Republic', away: 'Czechia', score: { fullTime: { home: 0, away: 0 } } }),
      apiMatch({ home: 'Türkiye', away: 'Paraguay', score: { fullTime: { home: 2, away: 2 } } }),
      apiMatch({ home: 'USA', away: 'Australia', score: { fullTime: { home: 1, away: 1 } } }),
    ])
    expect(unmapped).toEqual([])
    expect(scores).toEqual({
      A2: { home: 0, away: 0 },
      D4: { home: 2, away: 2 },
      D3: { home: 1, away: 1 },
    })
  })

  it('reports finished group matches it cannot map instead of dropping them silently', () => {
    const { scores, unmapped } = extractGroupScores([
      apiMatch({ home: 'Atlantis', away: 'Mexico' }),
    ])
    expect(scores).toEqual({})
    expect(unmapped).toEqual(['Atlantis vs Mexico'])
  })
})
