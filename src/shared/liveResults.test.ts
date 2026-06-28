import { describe, it, expect } from 'vitest'
import { mergeLiveResults } from './liveResults'
import type { LiveOverlay } from './espnLive'
import type { TournamentResults } from './types'

function base(): TournamentResults {
  return {
    groupMatches: {
      L: [
        { id: 'L1', homeTeam: 'England', awayTeam: 'Croatia', scores: { home: null, away: null } },
        { id: 'L2', homeTeam: 'Ghana', awayTeam: 'Panama', scores: { home: 2, away: 0 } },
      ],
    },
    groupTables: {},
    playerMatchGoals: { 'הארי קיין': { L2: 1 } },
    playerGoals: { 'הארי קיין': 1 },
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  }
}

const EMPTY: LiveOverlay = { scores: {}, goals: {} }

describe('mergeLiveResults', () => {
  it('returns the same object reference when the overlay is empty', () => {
    const b = base()
    expect(mergeLiveResults(b, EMPTY)).toBe(b)
  })

  it('overlays a live score onto a not-yet-final match', () => {
    const merged = mergeLiveResults(base(), { scores: { L1: { home: 1, away: 0 } }, goals: {} })
    expect(merged.groupMatches.L.find(m => m.id === 'L1')?.scores).toEqual({ home: 1, away: 0 })
  })

  it('never overrides a match that already has a final baked score', () => {
    const merged = mergeLiveResults(base(), { scores: { L2: { home: 9, away: 9 } }, goals: {} })
    expect(merged.groupMatches.L.find(m => m.id === 'L2')?.scores).toEqual({ home: 2, away: 0 })
  })

  it('merges live goals and recomputes player totals', () => {
    const merged = mergeLiveResults(base(), { scores: {}, goals: { 'הארי קיין': { L1: 2 } } })
    expect(merged.playerMatchGoals?.['הארי קיין']).toEqual({ L1: 2, L2: 1 })
    expect(merged.playerGoals?.['הארי קיין']).toBe(3)
  })

  it('ignores live goals for an already-final match', () => {
    const merged = mergeLiveResults(base(), { scores: {}, goals: { 'הארי קיין': { L2: 5 } } })
    expect(merged.playerMatchGoals?.['הארי קיין']).toEqual({ L2: 1 })
  })

  it('does not mutate the base results', () => {
    const b = base()
    mergeLiveResults(b, { scores: { L1: { home: 1, away: 0 } }, goals: { 'הארי קיין': { L1: 1 } } })
    expect(b.groupMatches.L.find(m => m.id === 'L1')?.scores).toEqual({ home: null, away: null })
    expect(b.playerMatchGoals?.['הארי קיין']).toEqual({ L2: 1 })
  })

  it('carries live status for an in-progress match', () => {
    const merged = mergeLiveResults(base(), { scores: { L1: { home: 1, away: 0 } }, goals: {}, live: { L1: { clock: "67'" } } })
    expect(merged.live).toEqual({ L1: { clock: "67'" } })
  })

  it('drops live status for a match that already has a baked final score', () => {
    const merged = mergeLiveResults(base(), { scores: {}, goals: {}, live: { L2: { clock: "90'" } } })
    expect(merged.live).toEqual({})
  })

  it('overlays a live score onto a knockout match keyed by matchNum', () => {
    const b = base()
    b.knockoutStages.r32 = [{ matchNum: 73, home: 'South Africa', away: 'Canada', resolved: true }]
    const merged = mergeLiveResults(b, {
      scores: { '73': { home: 1, away: 0 } },
      goals: {},
      live: { '73': { clock: "35'", home: 1, away: 0 } },
    })
    expect(merged.knockoutStages.r32[0].scores).toEqual({ home: 1, away: 0 })
    expect(merged.live).toEqual({ '73': { clock: "35'", home: 1, away: 0 } })
  })

  it('never overrides a knockout match that already has a baked final score', () => {
    const b = base()
    b.knockoutStages.r32 = [
      { matchNum: 73, home: 'South Africa', away: 'Canada', resolved: true, scores: { home: 2, away: 1 } },
    ]
    const merged = mergeLiveResults(b, {
      scores: { '73': { home: 9, away: 9 } },
      goals: {},
      live: { '73': { clock: "35'" } },
    })
    expect(merged.knockoutStages.r32[0].scores).toEqual({ home: 2, away: 1 })
    expect(merged.live).toEqual({})
  })

  it('does not mutate the base knockout stages', () => {
    const b = base()
    b.knockoutStages.r32 = [{ matchNum: 73, home: 'South Africa', away: 'Canada', resolved: true }]
    mergeLiveResults(b, { scores: { '73': { home: 1, away: 0 } }, goals: {}, live: {} })
    expect(b.knockoutStages.r32[0].scores).toBeUndefined()
  })
})
