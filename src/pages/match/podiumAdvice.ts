import type { PodiumByAdvancer } from '../../../sim-core'

// Below this gap (in probability) the two advancers are a wash for your podium
// odds — within Monte-Carlo noise at the card's sim count — so we don't assert a
// direction. Mirrors the spirit of sim-core's WIN_DELTA_EPS for the win% card.
export const PODIUM_PREF_EPS = 0.01
// A conditional read off fewer than this share of the sims (one advancer the model
// thinks is unlikely) is too thin to trust; we keep the number but soften the
// language around it.
export const PODIUM_NOISE_FLOOR = 0.05

export interface PodiumSide {
  team: string
  podium: number   // P(you finish top-3 | this team advances)
  delta: number    // podium − baseline: the signed lift this outcome gives you
}

export interface PodiumAdvice {
  // The two outcomes can't be separated for your podium odds — show them flat.
  noPreference: boolean
  baseline: number     // your podium odds before this match resolves
  better: PodiumSide   // the advancer that raises your podium odds more (delta ≥ 0)
  worse: PodiumSide    // the other one (delta ≤ 0): the conditionals straddle the baseline
  // One advancer is rare enough that its conditional is shaky — soften the claim.
  noisy: boolean
}

// Turn the raw conditional probabilities into the card's display decision: each
// outcome's *signed lift* vs the baseline (so we never imply both results raise
// you — by total probability one is above the marginal and one below), which side
// helps more, whether the two are a wash, and whether the read is too thin to
// trust. Pure — so it's unit-tested without the worker.
export function podiumAdvice(r: PodiumByAdvancer): PodiumAdvice {
  const base = r.podiumBaseline
  const a: PodiumSide = { team: r.teamA, podium: r.podiumIfA, delta: r.podiumIfA - base }
  const b: PodiumSide = { team: r.teamB, podium: r.podiumIfB, delta: r.podiumIfB - base }
  const [better, worse] = a.podium >= b.podium ? [a, b] : [b, a]
  const total = r.nA + r.nB
  return {
    noPreference: Math.abs(a.podium - b.podium) < PODIUM_PREF_EPS,
    baseline: base,
    better,
    worse,
    noisy: total === 0 || Math.min(r.nA, r.nB) < PODIUM_NOISE_FLOOR * total,
  }
}
