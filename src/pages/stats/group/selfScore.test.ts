import { describe, it, expect } from 'vitest'
import {
  buildContext,
  scoreGroupOutcome,
  thirdPlaceOutlook,
  type ThirdLine,
  type ThirdField,
} from './selfScore'
import type { User } from '../../../users'
import type { PredictionsState, Standing } from '../../../shared/types'

// Direct, hand-computed checks of the scoring engine. These do NOT lean on the
// recommendation code — they pin the raw point math (match/place/advancement) and
// the best-third outlook to numbers worked out by hand from the rules:
//   group match: פגיעה=2, צליפה=4 · place=1 per exact slot · עולה=4 per advancer.

function standingsOf(order: string[]): Standing[] {
  return order.map(team => ({ team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }))
}

// Minimal User carrying only what the scorer reads.
function makeUser(opts: {
  predictions: PredictionsState
  predOrderA: string[]
  thirdPick?: string
}): User {
  const tpq = opts.thirdPick
    ? { resolved: true as const, all: [], qualifiers: [{ group: 'A', team: opts.thirdPick } as never] }
    : { resolved: false as const, all: [], tied: [] }
  return {
    label: 'בדיקה',
    predictions: opts.predictions,
    topGoalscorer: '',
    groupTables: { A: standingsOf(opts.predOrderA) },
    thirdPlaceQualification: tpq,
    groupMatches: {},
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  } as unknown as User
}

describe('scoreGroupOutcome — hand-computed group A scenario', () => {
  // Group A: Mexico, South Africa, South Korea, Czech Republic.
  // Final scores we feed (the "actual" of this scenario):
  //   A1 Mexico 2-0 South Africa  | A2 South Korea 1-1 Czech
  //   A3 Czech 2-0 South Africa   | A4 Mexico 1-0 South Korea
  //   A5 Czech 0-1 Mexico         | A6 South Africa 0-1 South Korea
  // Records: Mexico 9 (GD+4) · Czech 4 (GD+1) · South Korea 4 (GD0) · South Africa 0.
  // Final order by points then GD: Mexico > Czech > South Korea > South Africa.
  const actual: PredictionsState = {
    A1: { home: 2, away: 0 },
    A2: { home: 1, away: 1 },
    A3: { home: 2, away: 0 },
    A4: { home: 1, away: 0 },
    A5: { home: 0, away: 1 },
    A6: { home: 0, away: 1 },
  }

  it('computes order with the goal-difference tiebreak (Czech above South Korea)', () => {
    const user = makeUser({ predictions: actual, predOrderA: ['Mexico', 'Czech Republic', 'South Korea', 'South Africa'] })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.order).toEqual(['Mexico', 'Czech Republic', 'South Korea', 'South Africa'])
  })

  it('place points: exact predicted order ⇒ 4', () => {
    const user = makeUser({ predictions: actual, predOrderA: ['Mexico', 'Czech Republic', 'South Korea', 'South Africa'] })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.placePoints).toBe(4)
  })

  it('place points: predicting 2nd/3rd swapped ⇒ only 2 (1st + 4th right)', () => {
    const user = makeUser({ predictions: actual, predOrderA: ['Mexico', 'South Korea', 'Czech Republic', 'South Africa'] })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.placePoints).toBe(2)
  })

  it('advancement: a predicted top-2 team that lands 3rd still counts while not mathematically out (8 pts)', () => {
    // predAdvancers = top2 of table = Mexico (1st) + South Korea (predicted 2nd, finishes 3rd).
    // No other groups settled ⇒ South Korea third outlook is "open" ⇒ still counts.
    const user = makeUser({ predictions: actual, predOrderA: ['Mexico', 'South Korea', 'Czech Republic', 'South Africa'] })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.advPoints).toBe(8)
    expect(new Set(s.advancers)).toEqual(new Set(['Mexico', 'South Korea']))
  })

  it('match points: 2 exact (צליפה=4) + 4 correct-direction (פגיעה=2) ⇒ 16', () => {
    // Predict: A1 2-0 (exact=4) · A2 1-1 (exact=4) · A3 1-0 Czech (pagiya=2) ·
    //          A4 3-0 Mexico (pagiya=2) · A5 0-2 Mexico-away (pagiya=2) · A6 0-2 SK-away (pagiya=2)
    const predictions: PredictionsState = {
      A1: { home: 2, away: 0 },
      A2: { home: 1, away: 1 },
      A3: { home: 1, away: 0 },
      A4: { home: 3, away: 0 },
      A5: { home: 0, away: 2 },
      A6: { home: 0, away: 2 },
    }
    const user = makeUser({ predictions, predOrderA: ['Mexico', 'Czech Republic', 'South Korea', 'South Africa'] })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.matchPoints).toBe(16)
    // total = match 16 + place 4 + adv 8 = 28
    expect(s.total).toBe(28)
  })

  it('sets thirdStatus for the predicted advancer that lands 3rd', () => {
    const user = makeUser({
      predictions: actual,
      predOrderA: ['Mexico', 'Czech Republic', 'South Korea', 'South Africa'],
      thirdPick: 'South Korea',
    })
    const ctx = buildContext(user, 'A', {})
    const s = scoreGroupOutcome(user.predictions, ctx, actual)
    expect(s.thirdPick).toBe('South Korea')
    // 4 points and no other groups settled yet: not mathematically clinched, but
    // enough points that it realistically always advances ⇒ 'safe', not 'open'.
    expect(s.thirdStatus).toBe('safe')
  })
})

describe('thirdPlaceOutlook — clinch / open / out math (8 best thirds qualify)', () => {
  const line: ThirdLine = { points: 3, gd: 0, gf: 2 }

  it('no rivals ahead, many groups unknown ⇒ open', () => {
    const field: ThirdField = { otherThirds: [], unknownOthers: 11 }
    expect(thirdPlaceOutlook(line, field)).toBe('open')
  })

  it('8 thirds strictly better ⇒ out', () => {
    const better: ThirdLine = { points: 9, gd: 9, gf: 9 }
    const field: ThirdField = { otherThirds: Array(8).fill(better), unknownOthers: 0 }
    expect(thirdPlaceOutlook(line, field)).toBe('out')
  })

  it('7 better and the rest known (8th best) ⇒ in', () => {
    const better: ThirdLine = { points: 9, gd: 9, gf: 9 }
    const worse: ThirdLine = { points: 0, gd: 0, gf: 0 }
    const field: ThirdField = { otherThirds: [...Array(7).fill(better), ...Array(4).fill(worse)], unknownOthers: 0 }
    expect(thirdPlaceOutlook(line, field)).toBe('in')
  })

  it('3 ahead + 4 unknown = 7 worst case < 8 ⇒ in', () => {
    const better: ThirdLine = { points: 9, gd: 9, gf: 9 }
    const field: ThirdField = { otherThirds: Array(3).fill(better), unknownOthers: 4 }
    expect(thirdPlaceOutlook(line, field)).toBe('in')
  })

  it('open zone but only 2 points ⇒ realistically out (judgement floor)', () => {
    const weak: ThirdLine = { points: 2, gd: 5, gf: 9 }
    const field: ThirdField = { otherThirds: [], unknownOthers: 11 }
    // Mathematically still "open", but a 2-point third is treated as dead.
    expect(thirdPlaceOutlook(weak, field)).toBe('out')
  })

  it('open zone with exactly 3 points ⇒ still open (on the bubble, not dropped)', () => {
    const bubble: ThirdLine = { points: 3, gd: -2, gf: 1 }
    const field: ThirdField = { otherThirds: [], unknownOthers: 11 }
    expect(thirdPlaceOutlook(bubble, field)).toBe('open')
  })

  it('open zone with 4+ points ⇒ safe (near-certain, not just "open")', () => {
    const field: ThirdField = { otherThirds: [], unknownOthers: 11 }
    expect(thirdPlaceOutlook({ points: 4, gd: 0, gf: 2 }, field)).toBe('safe')
    expect(thirdPlaceOutlook({ points: 6, gd: 3, gf: 5 }, field)).toBe('safe')
  })

  it('a clinched third on 2 points is NEVER downgraded by the floor', () => {
    // 7 better + 4 worse, nothing unknown ⇒ 8th best ⇒ mathematically in, even on 2 pts.
    const better: ThirdLine = { points: 9, gd: 9, gf: 9 }
    const worse: ThirdLine = { points: 0, gd: 0, gf: 0 }
    const weak: ThirdLine = { points: 2, gd: 0, gf: 0 }
    const field: ThirdField = { otherThirds: [...Array(7).fill(better), ...Array(4).fill(worse)], unknownOthers: 0 }
    expect(thirdPlaceOutlook(weak, field)).toBe('in')
  })

  it('respects the points→GD→GF comparison when counting who is ahead', () => {
    const field: ThirdField = {
      otherThirds: [
        { points: 3, gd: 1, gf: 0 },  // ahead: higher GD
        { points: 3, gd: 0, gf: 1 },  // NOT ahead: same GD, lower GF
        { points: 3, gd: 0, gf: 3 },  // ahead: same GD, higher GF
        { points: 4, gd: 0, gf: 0 },  // ahead: more points
        { points: 2, gd: 9, gf: 9 },  // NOT ahead: fewer points
      ],
      unknownOthers: 0,
    }
    // 3 ahead, all known ⇒ 4th best ⇒ in.
    expect(thirdPlaceOutlook(line, field)).toBe('in')
  })
})
