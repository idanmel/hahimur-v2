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
})
