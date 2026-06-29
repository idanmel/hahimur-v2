import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import {
  extractGroupScores,
  extractEspnGroupScores,
  extractEspnGroupScorers,
  extractEspnKnockoutScores,
  mergeScores,
  gatherScores,
  parseFakeFinished,
  SCORER_ALIASES,
  type ApiMatch,
  type EspnEvent,
  type EspnScoringPlay,
  type EspnSummary,
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

function goal(scorer: string, over: Partial<EspnScoringPlay> = {}): EspnScoringPlay {
  return { scoringPlay: true, ownGoal: false, athletesInvolved: [{ displayName: scorer }], ...over }
}

describe('extractEspnGroupScorers', () => {
  it('records goals by a tracked player', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', details: [goal('Kai Havertz')] }),
    ])
    expect(result).toEqual({ 'קאי האברץ': { E1: 1 } })
  })

  it('counts multiple goals by the same player in the same match', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', details: [goal('Kai Havertz'), goal('Kai Havertz')] }),
    ])
    expect(result).toEqual({ 'קאי האברץ': { E1: 2 } })
  })

  it('skips own goals', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', details: [goal('Kai Havertz', { ownGoal: true })] }),
    ])
    expect(result).toEqual({})
  })

  it('skips non-scoring plays such as cards', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', details: [goal('Kai Havertz', { scoringPlay: false })] }),
    ])
    expect(result).toEqual({})
  })

  it('skips players not in SCORER_ALIASES', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', details: [goal('Jamal Musiala')] }),
    ])
    expect(result).toEqual({})
  })

  it('ignores matches that have not completed', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Curaçao', completed: false, state: 'in', details: [goal('Kai Havertz')] }),
    ])
    expect(result).toEqual({})
  })

  it('ignores knockout matches between known teams that are not a group pairing', () => {
    const result = extractEspnGroupScorers([
      espnEvent({ home: 'Germany', away: 'Mexico', details: [goal('Kai Havertz')] }),
    ])
    expect(result).toEqual({})
  })

  it('covers all picked players in SCORER_ALIASES', () => {
    const picked = ['קיליאן אמבפה', 'הארי קיין', 'קאי האברץ', 'פראן טורס', 'לאמין ימאל', 'פלוריאן וירץ', 'ויניסיוס ג׳וניור']
    const covered = new Set(Object.values(SCORER_ALIASES))
    for (const p of picked) expect(covered).toContain(p)
  })
})

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
  details?: EspnScoringPlay[]
}): EspnEvent {
  return {
    status: { type: { state: over.state ?? 'post', completed: over.completed ?? true } },
    competitions: [{
      competitors: [
        { homeAway: 'home', score: over.homeScore ?? '1', team: { displayName: over.home } },
        { homeAway: 'away', score: over.awayScore ?? '0', team: { displayName: over.away } },
      ],
      details: over.details,
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

  it('skips events that have no status field instead of crashing', () => {
    const noStatus = { competitions: espnEvent({ home: 'Mexico', away: 'South Africa' }).competitions } as EspnEvent
    const { scores } = extractEspnGroupScores([
      noStatus,
      espnEvent({ home: 'South Korea', away: 'Czechia', homeScore: '2', awayScore: '1' }),
    ])
    expect(scores).toEqual({ A2: { home: 2, away: 1 } })
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

// matchNum 73 is South Africa (home) vs Canada (away) in our bracket; ESPN event
// id 760486. A KO scoreboard event carries an id but no usable score — the 90'
// regulation figure lives in the per-event summary's period linescores.
function koEvent(over: { id: string; completed?: boolean }): EspnEvent {
  return {
    id: over.id,
    status: { type: { state: over.completed === false ? 'in' : 'post', completed: over.completed ?? true } },
    competitions: [{ competitors: [] }],
  }
}

const ls = (vals: string[]) => vals.map(v => ({ displayValue: v }))

function koSummary(
  home: { team: string; ls: string[]; winner?: boolean },
  away: { team: string; ls: string[]; winner?: boolean },
): EspnSummary {
  return {
    header: {
      competitions: [{
        competitors: [
          { homeAway: 'home', winner: home.winner ?? false, team: { displayName: home.team }, linescores: ls(home.ls) },
          { homeAway: 'away', winner: away.winner ?? false, team: { displayName: away.team }, linescores: ls(away.ls) },
        ],
      }],
    },
  }
}

describe('extractEspnKnockoutScores', () => {
  it('writes a decisive regulation score for a completed KO match', async () => {
    const { scores } = await extractEspnKnockoutScores(
      [koEvent({ id: '760486' })],
      async () => koSummary({ team: 'South Africa', ls: ['0', '0'] }, { team: 'Canada', ls: ['0', '1'], winner: true }),
    )
    expect(scores).toEqual({ '73': { home: 0, away: 1 } })
  })

  it('carries the advancer on a regulation draw decided by penalties', async () => {
    const { scores } = await extractEspnKnockoutScores(
      [koEvent({ id: '760486' })],
      async () => koSummary(
        { team: 'South Africa', ls: ['1', '1', '0', '0', '4'], winner: true },
        { team: 'Canada', ls: ['1', '1', '0', '0', '2'] },
      ),
    )
    expect(scores).toEqual({ '73': { home: 2, away: 2, drawWinner: 'home' } })
  })

  it('flips home/away (and the advancer) when ESPN lists the teams reversed', async () => {
    const { scores } = await extractEspnKnockoutScores(
      [koEvent({ id: '760486' })],
      async () => koSummary(
        { team: 'Canada', ls: ['1', '1', '0', '0', '4'], winner: true },
        { team: 'South Africa', ls: ['1', '1', '0', '0', '2'] },
      ),
    )
    // Our bracket is SA (home) vs Canada (away); Canada won on pens → drawWinner away.
    expect(scores).toEqual({ '73': { home: 2, away: 2, drawWinner: 'away' } })
  })

  it('skips an in-progress KO match (not completed)', async () => {
    const fetchSummary = vi.fn(async () => koSummary({ team: 'South Africa', ls: ['1'] }, { team: 'Canada', ls: ['0'] }))
    const { scores } = await extractEspnKnockoutScores([koEvent({ id: '760486', completed: false })], fetchSummary)
    expect(scores).toEqual({})
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('skips a completed event whose id is not a known KO fixture (e.g. a group match)', async () => {
    const fetchSummary = vi.fn(async () => koSummary({ team: 'A', ls: ['1', '0'] }, { team: 'B', ls: ['0', '0'] }))
    const { scores } = await extractEspnKnockoutScores([koEvent({ id: '999999' })], fetchSummary)
    expect(scores).toEqual({})
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('warns and skips when a summary fetch fails, leaving other matches intact', async () => {
    const { scores, warnings } = await extractEspnKnockoutScores(
      [koEvent({ id: '760486' }), koEvent({ id: '760487' })],
      async (id) => {
        if (id === '760486') throw new Error('boom')
        return koSummary({ team: 'Brazil', ls: ['0', '2'], winner: true }, { team: 'Japan', ls: ['1', '0'] })
      },
    )
    expect(scores['73']).toBeUndefined()
    expect(scores['76']).toEqual({ home: 2, away: 1 })
    expect(warnings.some(w => w.includes('760486') && w.includes('boom'))).toBe(true)
  })

  it('warns and skips when the summary has no regulation score yet', async () => {
    const { scores, warnings } = await extractEspnKnockoutScores(
      [koEvent({ id: '760486' })],
      async () => koSummary({ team: 'South Africa', ls: [] }, { team: 'Canada', ls: [] }),
    )
    expect(scores).toEqual({})
    expect(warnings.some(w => w.includes('no regulation score'))).toBe(true)
  })
})
