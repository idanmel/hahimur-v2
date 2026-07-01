import { describe, it, expect } from 'vitest'
import { accumulateScorerTotals } from './scorerTotals'
import type { LiveEvent } from './espnLive'

function ev(scorers: string[], over: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: null,
    state: 'post',
    completed: true,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    scorers,
    ...over,
  }
}

describe('accumulateScorerTotals', () => {
  it('returns an empty tally when there are no events', () => {
    expect(accumulateScorerTotals([])).toEqual({})
  })

  it('sums a player’s goals across multiple matches', () => {
    const totals = accumulateScorerTotals([
      ev(['Lionel Messi', 'Kylian Mbappé']),
      ev(['Lionel Messi']),
      ev(['Lionel Messi', 'Erling Haaland']),
    ])
    expect(totals).toEqual({
      'Lionel Messi': 3,
      'Kylian Mbappé': 1,
      'Erling Haaland': 1,
    })
  })

  it('counts multiple goals by the same player within one match', () => {
    const totals = accumulateScorerTotals([ev(['Harry Kane', 'Harry Kane', 'Harry Kane'])])
    expect(totals).toEqual({ 'Harry Kane': 3 })
  })

  it('counts unpicked and picked players alike (no allowlist filter)', () => {
    // Messi is not on anyone's ticket, but the race board still needs him.
    const totals = accumulateScorerTotals([ev(['Lionel Messi'])])
    expect(totals['Lionel Messi']).toBe(1)
  })
})
