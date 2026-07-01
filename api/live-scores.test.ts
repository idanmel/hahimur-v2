import { describe, it, expect } from 'vitest'
import { slimEvent, type EspnEvent } from './live-scores'

function play(over: Record<string, unknown>): Record<string, unknown> {
  return { scoringPlay: true, ownGoal: false, athletesInvolved: [], ...over }
}

function event(details: Record<string, unknown>[]): EspnEvent {
  return {
    id: '1',
    status: { type: { state: 'in', completed: false } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', score: '2', team: { displayName: 'Argentina' } },
          { homeAway: 'away', score: '1', team: { displayName: 'France' } },
        ],
        details,
      },
    ],
  }
}

describe('slimEvent scorer extraction', () => {
  it('collects one entry per non-own in-match goal', () => {
    const slim = slimEvent(event([
      play({ athletesInvolved: [{ displayName: 'Lionel Messi' }] }),
      play({ athletesInvolved: [{ displayName: 'Lionel Messi' }] }),
      play({ athletesInvolved: [{ displayName: 'Kylian Mbappé' }] }),
    ]))
    expect(slim?.scorers).toEqual(['Lionel Messi', 'Lionel Messi', 'Kylian Mbappé'])
  })

  it('skips own goals', () => {
    const slim = slimEvent(event([
      play({ ownGoal: true, athletesInvolved: [{ displayName: 'Own Goaler' }] }),
      play({ athletesInvolved: [{ displayName: 'Lionel Messi' }] }),
    ]))
    expect(slim?.scorers).toEqual(['Lionel Messi'])
  })

  it('skips penalty-shootout kicks so they never inflate a scorer total', () => {
    // ESPN marks a shootout kick as scoringPlay:true (same type as an in-match
    // penalty) — only `shootout:true` distinguishes it. Must be excluded.
    const slim = slimEvent(event([
      play({ athletesInvolved: [{ displayName: 'Bilal El Khannouss' }] }),
      play({ shootout: true, athletesInvolved: [{ displayName: 'Bilal El Khannouss' }] }),
      play({ shootout: true, athletesInvolved: [{ displayName: 'Someone Else' }] }),
    ]))
    expect(slim?.scorers).toEqual(['Bilal El Khannouss'])
  })
})
