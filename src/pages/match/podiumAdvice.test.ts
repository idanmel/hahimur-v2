import { describe, expect, test } from 'vitest'
import { podiumAdvice, PODIUM_PREF_EPS, PODIUM_NOISE_FLOOR } from './podiumAdvice'
import type { PodiumByAdvancer } from '../../../sim-core'

const make = (o: Partial<PodiumByAdvancer>): PodiumByAdvancer => ({
  matchNum: 74, teamA: 'Germany', teamB: 'Paraguay',
  podiumIfA: 0.05, podiumIfB: 0.05, podiumBaseline: 0.05,
  winIfA: 0.01, winIfB: 0.01, winBaseline: 0.01, nA: 2000, nB: 2000, ...o,
})

describe('podiumAdvice', () => {
  test('names the advancer that raises your podium odds more', () => {
    const a = podiumAdvice(make({ podiumIfA: 0.056, podiumIfB: 0.076 }))
    expect(a.better.team).toBe('Paraguay')
    expect(a.worse.team).toBe('Germany')
    expect(a.noPreference).toBe(false)
    expect(a.noisy).toBe(false)
  })

  test('reports each side as a signed lift vs the baseline', () => {
    // baseline is the advance-weighted average of the two conditionals
    const a = podiumAdvice(make({ podiumIfA: 0.061, podiumIfB: 0.074, podiumBaseline: 0.066 }))
    expect(a.baseline).toBe(0.066)
    expect(a.better.team).toBe('Paraguay')
    expect(a.better.delta).toBeCloseTo(0.008, 6)   // above baseline
    expect(a.worse.delta).toBeCloseTo(-0.005, 6)   // below baseline
  })

  test('flags a wash when the two outcomes are within the noise epsilon', () => {
    const a = podiumAdvice(make({ podiumIfA: 0.055, podiumIfB: 0.05 })) // gap 0.005 < eps
    expect(a.noPreference).toBe(true)
  })

  test('a gap exactly at the epsilon is not a wash', () => {
    const a = podiumAdvice(make({ podiumIfA: 0.05 + PODIUM_PREF_EPS, podiumIfB: 0.05 }))
    expect(a.noPreference).toBe(false)
  })

  test('marks the read noisy when one advancer is rarer than the floor', () => {
    const total = 4000
    const a = podiumAdvice(make({ nA: Math.floor(PODIUM_NOISE_FLOOR * total) - 1, nB: total - 1 }))
    expect(a.noisy).toBe(true)
  })

  test('ties resolve to teamA as the "better" side', () => {
    const a = podiumAdvice(make({ podiumIfA: 0.07, podiumIfB: 0.07 }))
    expect(a.better.team).toBe('Germany')
    expect(a.noPreference).toBe(true)
  })

  test("the 'win' metric reads the win* fields, not the podium ones", () => {
    const a = podiumAdvice(
      make({
        podiumIfA: 0.9, podiumIfB: 0.1, podiumBaseline: 0.5, // podium would favour Germany
        winIfA: 0.02, winIfB: 0.08, winBaseline: 0.05,        // win favours Paraguay
      }),
      'win',
    )
    expect(a.baseline).toBe(0.05)
    expect(a.better.team).toBe('Paraguay')
    expect(a.better.podium).toBe(0.08)
    expect(a.better.delta).toBeCloseTo(0.03, 6)
    expect(a.worse.delta).toBeCloseTo(-0.03, 6)
  })
})
