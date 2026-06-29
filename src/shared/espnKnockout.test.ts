import { describe, expect, test } from 'vitest'
import { extractEspnKnockoutResult } from './espnKnockout'

// Real ESPN summary linescores (header.competitions[0].competitors[].linescores),
// per period: [1st half, 2nd half, ET1, ET2, shootout]. The regulation (90') score
// — what KO predictions are judged against — is period 1 + period 2, never the
// after-ET `score` field.
const ls = (vals: string[]) => vals.map(v => ({ displayValue: v }))

describe('extractEspnKnockoutResult', () => {
  test('regulation win → 90′ score from 2 periods, no advancer flag (NED 3-1 USA)', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: true,  linescores: ls(['2', '1']) },
      { homeAway: 'away', winner: false, linescores: ls(['0', '1']) },
    ])).toEqual({ scores: { home: 3, away: 1 }, decidedBy: 'reg' })
  })

  test('penalties, home advances → regulation draw + drawWinner home (final ARG-FRA)', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: true,  linescores: ls(['2', '0', '0', '1', '4']) },
      { homeAway: 'away', winner: false, linescores: ls(['0', '2', '0', '1', '2']) },
    ])).toEqual({ scores: { home: 2, away: 2, drawWinner: 'home' }, decidedBy: 'pens' })
  })

  test('penalties, away advances → drawWinner away (NED-ARG)', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: false, linescores: ls(['0', '2', '0', '0', '3']) },
      { homeAway: 'away', winner: true,  linescores: ls(['1', '1', '0', '0', '4']) },
    ])).toEqual({ scores: { home: 2, away: 2, drawWinner: 'away' }, decidedBy: 'pens' })
  })

  test('extra time, no penalties → keeps the 90′ score, not the ET result (synthetic)', () => {
    // Constructed: no 2022 KO ended in ET without pens. reg 1-1, ET 1-0 home → 2-1
    // final, but the prediction is judged on the 1-1 at 90'.
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: true,  linescores: ls(['0', '1', '1', '0']) },
      { homeAway: 'away', winner: false, linescores: ls(['1', '0', '0', '0']) },
    ])).toEqual({ scores: { home: 1, away: 1, drawWinner: 'home' }, decidedBy: 'et' })
  })

  test('live 1-1 in regulation, no winner flagged yet → no advancer', () => {
    // Both halves played, score level, match still in progress: neither competitor
    // is flagged winner. The advancer is not yet known, so drawWinner stays unset
    // (otherwise it would default to 'away' and award phantom advancement points).
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: false, linescores: ls(['1', '0']) },
      { homeAway: 'away', winner: false, linescores: ls(['0', '1']) },
    ])).toEqual({ scores: { home: 1, away: 1 }, decidedBy: 'reg' })
  })

  test('tied in extra time, still no winner → no advancer', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: false, linescores: ls(['1', '0', '0']) },
      { homeAway: 'away', winner: false, linescores: ls(['0', '1', '0']) },
    ])).toEqual({ scores: { home: 1, away: 1 }, decidedBy: 'et' })
  })

  test('not enough periods yet (only 1st half) → null', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: false, linescores: ls(['1']) },
      { homeAway: 'away', winner: false, linescores: ls(['0']) },
    ])).toBeNull()
  })

  test('a missing side → null', () => {
    expect(extractEspnKnockoutResult([
      { homeAway: 'home', winner: true, linescores: ls(['1', '0']) },
    ])).toBeNull()
  })
})
