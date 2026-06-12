import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import {
  extractGroupScores,
  extractEspnGroupScores,
  mergeScores,
  gatherScores,
  parseFakeFinished,
  type ApiMatch,
  type EspnEvent,
} from './fetch-scores'

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

describe('parseFakeFinished', () => {
  it('parses a fake finished score spec like A1=9-9', () => {
    expect(parseFakeFinished('A1=9-9')).toEqual({ id: 'A1', home: 9, away: 9 })
  })

  it('rejects malformed specs', () => {
    expect(parseFakeFinished('A1')).toBeNull()
    expect(parseFakeFinished('A1=x-2')).toBeNull()
  })

  it('rejects unknown match IDs', () => {
    expect(parseFakeFinished('Z9=1-0')).toBeNull()
  })
})

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

function espnEvent(over: {
  home: string
  away: string
  homeScore?: string
  awayScore?: string
  state?: string
  completed?: boolean
}): EspnEvent {
  return {
    status: { type: { state: over.state ?? 'post', completed: over.completed ?? true } },
    competitions: [{
      competitors: [
        { homeAway: 'home', score: over.homeScore ?? '1', team: { displayName: over.home } },
        { homeAway: 'away', score: over.awayScore ?? '0', team: { displayName: over.away } },
      ],
    }],
  }
}

describe('extractEspnGroupScores', () => {
  it('maps a completed match to its match ID by team names', () => {
    const { scores } = extractEspnGroupScores([
      espnEvent({ home: 'Mexico', away: 'South Africa', homeScore: '2', awayScore: '0' }),
    ])
    expect(scores).toEqual({ A1: { home: 2, away: 0 } })
  })

  it('ignores matches that have not completed, even when they carry a score', () => {
    const { scores } = extractEspnGroupScores([
      espnEvent({ home: 'Mexico', away: 'South Africa', state: 'pre', completed: false, homeScore: '0', awayScore: '0' }),
      espnEvent({ home: 'Canada', away: 'Bosnia-Herzegovina', state: 'in', completed: false, homeScore: '1', awayScore: '0' }),
    ])
    expect(scores).toEqual({})
  })

  it('swaps the score when ESPN home/away order is reversed', () => {
    const { scores } = extractEspnGroupScores([
      espnEvent({ home: 'South Africa', away: 'Mexico', homeScore: '1', awayScore: '3' }),
    ])
    expect(scores).toEqual({ A1: { home: 3, away: 1 } })
  })

  it('resolves ESPN team names that differ from ours', () => {
    const { scores, unmapped } = extractEspnGroupScores([
      espnEvent({ home: 'South Korea', away: 'Czechia', homeScore: '2', awayScore: '1' }),
      espnEvent({ home: 'Türkiye', away: 'Paraguay', homeScore: '2', awayScore: '2' }),
    ])
    expect(unmapped).toEqual([])
    expect(scores).toEqual({
      A2: { home: 2, away: 1 },
      D4: { home: 2, away: 2 },
    })
  })

  it('silently skips completed knockout matches between known teams', () => {
    // Mexico (group A) vs Canada (group B) is not a group pairing, so it
    // must be a knockout match — not a mapping failure worth warning about.
    const { scores, unmapped } = extractEspnGroupScores([
      espnEvent({ home: 'Mexico', away: 'Canada' }),
    ])
    expect(scores).toEqual({})
    expect(unmapped).toEqual([])
  })

  it('reports completed matches with unknown team names', () => {
    const { scores, unmapped } = extractEspnGroupScores([
      espnEvent({ home: 'Group A 2nd Place', away: 'Mexico' }),
    ])
    expect(scores).toEqual({})
    expect(unmapped).toEqual(['Group A 2nd Place vs Mexico'])
  })

  it('reports completed matches whose score is not numeric', () => {
    const { scores, unmapped } = extractEspnGroupScores([
      espnEvent({ home: 'Mexico', away: 'South Africa', homeScore: '', awayScore: '0' }),
    ])
    expect(scores).toEqual({})
    expect(unmapped).toEqual(['Mexico vs South Africa'])
  })
})

describe('mergeScores', () => {
  it('combines scores from both sources', () => {
    const { scores } = mergeScores(
      { A1: { home: 2, away: 0 } },
      { A2: { home: 2, away: 1 } },
    )
    expect(scores).toEqual({ A1: { home: 2, away: 0 }, A2: { home: 2, away: 1 } })
  })

  it('lets the primary source win a disagreement and reports the conflict', () => {
    const { scores, conflicts } = mergeScores(
      { A1: { home: 2, away: 1 } },
      { A1: { home: 1, away: 1 } },
    )
    expect(scores).toEqual({ A1: { home: 2, away: 1 } })
    expect(conflicts).toEqual(['A1: primary says 2-1, backup says 1-1'])
  })

  it('does not report a conflict when both sources agree', () => {
    const { conflicts } = mergeScores(
      { A1: { home: 2, away: 0 } },
      { A1: { home: 2, away: 0 } },
    )
    expect(conflicts).toEqual([])
  })
})

describe('gatherScores', () => {
  const ok = (scores: Record<string, { home: number; away: number }>) =>
    async () => ({ scores, unmapped: [] })
  const boom = async (): Promise<{ scores: Record<string, { home: number; away: number }>; unmapped: string[] }> => {
    throw new Error('api down')
  }

  it('merges both sources when both succeed', async () => {
    const result = await gatherScores(ok({ A1: { home: 2, away: 0 } }), ok({ A2: { home: 2, away: 1 } }))
    expect(result?.scores).toEqual({ A1: { home: 2, away: 0 }, A2: { home: 2, away: 1 } })
  })

  it('continues with football-data when ESPN fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await gatherScores(boom, ok({ A1: { home: 2, away: 0 } }))
    expect(result?.scores).toEqual({ A1: { home: 2, away: 0 } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('api down'))
    warn.mockRestore()
  })

  it('continues with ESPN when football-data fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await gatherScores(ok({ A1: { home: 2, away: 0 } }), boom)
    expect(result?.scores).toEqual({ A1: { home: 2, away: 0 } })
    warn.mockRestore()
  })

  it('returns null when both sources fail', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await gatherScores(boom, boom)).toBeNull()
    warn.mockRestore()
  })
})
