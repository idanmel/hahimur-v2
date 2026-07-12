import { TEAM_STRENGTH } from '../pages/results/teamStrength'
import { marketOutcomeOdds, MARKET_WEIGHT } from './marketOdds'

// The Poisson goal-rate model, shared by the Monte-Carlo engine (sim-core) and
// the per-match odds shown on the cards, so the two can never disagree: a side's
// expected goals is λ = BASE × attacker.att × defender.def, with a light host
// edge for the 2026 co-hosts. Single source — change the football here once.
//
// When a fixture has real bookmaker lines we go one step further and re-calibrate
// the two λ's so the model reproduces a market-leaning outcome (see marketLambdas
// below). Because EVERYTHING — card odds and the simulation — reads λ from here,
// folding the market in at this one spot keeps the whole app on a single,
// market-aware basis instead of only patching the card.
export const BASE = 1.3
const strength = (team: string) => TEAM_STRENGTH[team] ?? { att: 1.0, def: 1.0 }

// Host-nation edge. The 2026 hosts play on home soil (crowd, no travel,
// familiarity), an advantage the Elo priors — built from mostly-neutral and
// mixed-venue history — don't capture. World Cup home advantage is real but
// smaller and streakier than club football, so we keep it light: a host scores
// ~10% more and concedes ~8% fewer. Applied to the host regardless of nominal
// home/away; cancels out when both sides are hosts.
export const HOST_TEAMS = new Set(['United States', 'Mexico', 'Canada'])
export const HOST_ATT = 1.10
export const HOST_DEF = 0.92

// Pure Elo + host expected goals [home, away], before any market calibration.
function eloLambdas(home: string, away: string): [number, number] {
  const h = strength(home), a = strength(away)
  let lh = BASE * h.att * a.def
  let la = BASE * a.att * h.def
  const homeHost = HOST_TEAMS.has(home), awayHost = HOST_TEAMS.has(away)
  if (homeHost && !awayHost) { lh *= HOST_ATT; la *= HOST_DEF }
  else if (awayHost && !homeHost) { la *= HOST_ATT; lh *= HOST_DEF }
  return [lh, la]
}

// --- market calibration ----------------------------------------------------
// Given λ's, the closed-form 3-way (home win / draw / away win) under independent
// Poissons, summed over a score grid that holds essentially all football's mass.
const MAX_GOALS = 10
function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p = (p * lambda) / i
  return p
}
function decisiveHomeShare(lh: number, la: number): number {
  const hp: number[] = [], ap: number[] = []
  for (let k = 0; k <= MAX_GOALS; k++) { hp.push(poissonPmf(lh, k)); ap.push(poissonPmf(la, k)) }
  let homeWin = 0, awayWin = 0
  for (let h = 0; h <= MAX_GOALS; h++)
    for (let a = 0; a <= MAX_GOALS; a++) {
      if (h > a) homeWin += hp[h] * ap[a]
      else if (a > h) awayWin += hp[h] * ap[a]
    }
  const dec = homeWin + awayWin
  return dec > 0 ? homeWin / dec : 0.5
}

// Re-split the Elo λ's toward the market. We keep total expected goals (lh+la)
// from Elo — how open the game is — and only move the balance between the two
// sides so the model's decisive win-share matches a MARKET_WEIGHT blend of the
// market's and Elo's own win-share. One free parameter, monotonic → bisection.
// Result feeds both the card and the simulation, so they stay identical.
const marketCache = new Map<string, [number, number]>()
function marketLambdas(home: string, away: string, base: [number, number]): [number, number] {
  const market = marketOutcomeOdds(home, away)
  if (!market) return base
  const key = `${home}|${away}`
  const cached = marketCache.get(key)
  if (cached) return cached

  const [lh0, la0] = base
  const eloShare = decisiveHomeShare(lh0, la0)
  const marketShare = market.homeWin + market.awayWin > 0
    ? market.homeWin / (market.homeWin + market.awayWin)
    : 0.5
  const target = MARKET_WEIGHT * marketShare + (1 - MARKET_WEIGHT) * eloShare

  const total = lh0 + la0
  let lo = 0.001, hi = 0.999
  for (let i = 0; i < 60; i++) {
    const r = (lo + hi) / 2
    if (decisiveHomeShare(r * total, (1 - r) * total) < target) lo = r
    else hi = r
  }
  const r = (lo + hi) / 2
  const adjusted: [number, number] = [r * total, (1 - r) * total]
  marketCache.set(key, adjusted)
  return adjusted
}

// Expected goals [home, away] for a fixture, before any random draw. Market-aware:
// fixtures with bookmaker lines are re-calibrated toward the market, the rest stay
// pure Elo. This is the single source every consumer (cards + sim-core) reads from.
export function matchLambdas(home: string, away: string): [number, number] {
  return marketLambdas(home, away, eloLambdas(home, away))
}
